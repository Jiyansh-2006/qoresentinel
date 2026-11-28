import { qorechainTestnet } from '@qorechain/evm';
import { CHAIN_UPGRADE_V3_2_3, deriveUnifiedAccount, derivePqcCanonical, buildRegisterPqcKeyMsg, EthNativeSigner, fetchEvmWindow, fetchPqcStatus, isUpgradeApplied, msg, openEvmWindowMsg, signProofOfPossession, verifyProofOfPossession } from '@qorechain/sdk';
import { StargateClient } from '@cosmjs/stargate';
import { createPublicClient, createWalletClient, http, parseEther, type Address, type Chain, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const REST = process.env.QORE_REST || 'https://api-testnet.qore.host';
const RPC = process.env.QORE_RPC || 'https://rpc-testnet.qore.host';
const EVM_RPC = process.env.QORE_EVM_RPC || 'https://evm-testnet.qore.host';
const CHAIN_ID = 9800;
// The adapter and API resolve separate viem type copies; the runtime chain
// definition is compatible, so narrow it at this boundary.
const chain = qorechainTestnet as unknown as Chain;
const abi = [
  { type: 'function', name: 'payGrant', stateMutability: 'nonpayable', inputs: [{name:'applicationId',type:'bytes32'},{name:'applicant',type:'address'},{name:'amount',type:'uint256'},{name:'evidenceHash',type:'bytes32'}], outputs: [] },
  { type: 'function', name: 'paidApplication', stateMutability: 'view', inputs: [{name:'',type:'bytes32'}], outputs: [{type:'bool'}] }
] as const;

export async function networkHealth() {
  const [rpc, evm, pqc, abstractAccount] = await Promise.allSettled([
    fetch(`${RPC}/status`).then(r => r.json()),
    fetch(EVM_RPC, { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]}) }).then(r=>r.json()),
    fetch(`${REST}/qorechain/pqc/v1/protocol_features`).then(r=>r.json()),
    fetch(`${REST}/qorechain/abstractaccount/v1/config`).then(r=>r.json())
  ]);
  const evmChain = evm.status === 'fulfilled' ? Number.parseInt(evm.value?.result || '0x0', 16) : 0;
  return { network: 'qorechain-diana', expectedEvmChainId: CHAIN_ID, evmChainId: evmChain, connected: evmChain === CHAIN_ID, rpc: rpc.status === 'fulfilled', protocolFeatures: pqc.status === 'fulfilled' ? pqc.value : null, abstractAccount: abstractAccount.status === 'fulfilled' ? abstractAccount.value : null };
}

export async function getWindowStatus(address: string) {
  const response = await fetch(`${REST}/qorechain/pqc/v1/evm_window/${address}`);
  if (!response.ok) throw new Error(`Could not read EVM authorisation window (${response.status}).`);
  return response.json();
}

export async function openAgentWindow() {
  const mnemonic = process.env.QORE_MNEMONIC;
  const target = process.env.GRANT_VAULT_ADDRESS as Address | undefined;
  if (!mnemonic || !target) throw new Error('Set QORE_MNEMONIC and GRANT_VAULT_ADDRESS before opening an on-chain window.');
  const accountBase = await deriveUnifiedAccount(mnemonic);
  const pqcKeypair = derivePqcCanonical(accountBase.cosmos, mnemonic);
  const account = { ...accountBase, pqc: pqcKeypair } as any;
  const transport = await StargateClient.connect(RPC);
  const keyStatus = await fetchPqcStatus({ rest: REST, address: account.cosmos });
  let pqcPossessionProven = keyStatus.possessionProven === true;
  if (!keyStatus.registered) {
    const proofSupported = await isUpgradeApplied({ rest: REST, upgrade: CHAIN_UPGRADE_V3_2_3 });
    if (!proofSupported) throw new Error('Diana Testnet has not enabled proof-of-possession PQC registration. Refusing to register without the requested proof.');
    const proofOfPossession = signProofOfPossession({ chainId: 'qorechain-diana', account: account.cosmos, keypair: pqcKeypair });
    if (!verifyProofOfPossession({ chainId: 'qorechain-diana', account: account.cosmos, publicKey: pqcKeypair.publicKey, proof: proofOfPossession })) {
      throw new Error('Local verification of the ML-DSA-87 proof of possession failed.');
    }
    const classicalSigner = new EthNativeSigner(account, { signMode: 'classical', rest: REST });
    const sequence = await transport.getSequence(account.cosmos);
    const publicKeyBytes = Uint8Array.from(Buffer.from(account.publicKey.replace(/^0x/, ''), 'hex'));
    await classicalSigner.signAndBroadcast(transport, {
      chainId: 'qorechain-diana', accountNumber: sequence.accountNumber, sequence: sequence.sequence,
      messages: [buildRegisterPqcKeyMsg(account.cosmos, { pqcKeypair, ecdsaPubkey: publicKeyBytes, proofOfPossession })],
      fee: { amount: [{ denom: 'uqor', amount: '60000' }], gas: '600000' }
    });
    const verified = await fetchPqcStatus({ rest: REST, address: account.cosmos });
    if (!verified.registered || verified.possessionProven !== true) throw new Error('PQC key registration was broadcast, but Diana did not confirm the key and its proof of possession.');
    pqcPossessionProven = true;
  }
  const signer = new EthNativeSigner(account, { rest: REST });
  const sequence = await transport.getSequence(account.cosmos);
  const result = await signer.signAndBroadcast(transport, {
    chainId: 'qorechain-diana', accountNumber: sequence.accountNumber, sequence: sequence.sequence,
    fee: { amount: [{ denom: 'uqor', amount: '100000' }], gas: '800000' },
    messages: [openEvmWindowMsg({ sender: account.cosmos, blocks: 1200, maxTxs: 5, maxValue: '5000000', allowedTargets: [target] })]
  });
  const window = await fetchEvmWindow({ rest: REST, address: account.cosmos });
  return { txHash: result.transactionHash, address: account.cosmos, evmAddress: account.evm, pqcPossessionProven, window };
}

export async function configureSessionSpendingRule() {
  const mnemonic = process.env.QORE_MNEMONIC;
  if (!mnemonic) throw new Error('Set QORE_MNEMONIC before configuring on-chain spending rules.');
  const configResponse = await fetch(`${REST}/qorechain/abstractaccount/v1/config`);
  if (!configResponse.ok) throw new Error('Could not read QoreChain abstract-account configuration.');
  const config = await configResponse.json() as any;
  if (config.enabled !== true) throw new Error('QoreChain abstract-account module is not enabled on this network.');
  const accountBase = await deriveUnifiedAccount(mnemonic);
  const pqcKeypair = derivePqcCanonical(accountBase.cosmos, mnemonic);
  const account = { ...accountBase, pqc: pqcKeypair } as any;
  const pqcStatusResponse = await fetch(`${REST}/qorechain/pqc/v1/account/${account.cosmos}`);
  if (!pqcStatusResponse.ok) throw new Error('Could not verify PQC registration. Open the scoped EVM window first to register the key.');
  const pqcStatus = await pqcStatusResponse.json() as any;
  if (!(pqcStatus.registered || pqcStatus.public_key || pqcStatus.account?.registered || pqcStatus.pqc_key?.public_key || pqcStatus.pqcKey?.publicKey)) throw new Error('PQC key is not registered. Open the scoped EVM window first.');
  const transport = await StargateClient.connect(RPC);
  const signer = new EthNativeSigner(account, { rest: REST });
  const sequence = await transport.getSequence(account.cosmos);
  const rule = msg.abstractaccount.updateSpendingRules({
    owner: account.cosmos,
    accountAddress: account.cosmos,
    rules: [{ id: 'qoresentinel-session', perTxLimit: '500000', dailyLimit: '2000000', allowedDenoms: ['uqor'], enabled: true }]
  });
  const result = await signer.signAndBroadcast(transport, {
    chainId: 'qorechain-diana', accountNumber: sequence.accountNumber, sequence: sequence.sequence,
    fee: { amount: [{ denom: 'uqor', amount: '100000' }], gas: '800000' }, messages: [rule]
  });
  return { txHash: result.transactionHash, account: account.cosmos, rule: { id: 'qoresentinel-session', perTxLimit: '500000', dailyLimit: '2000000', allowedDenoms: ['uqor'] } };
}

export async function executeGrantOnChain(input: { applicationId: string; walletAddress: string; amountQor: number; evidenceHash: string }) {
  if (process.env.DEMO_MODE !== 'false') return { simulated: true, txHash: `DEMO-${input.applicationId.slice(0, 12)}`, detail: 'DEMO_MODE is enabled; no blockchain transaction was sent.' };
  const mnemonic = process.env.QORE_MNEMONIC;
  const vault = process.env.GRANT_VAULT_ADDRESS as Address | undefined;
  if (!mnemonic || !vault) throw new Error('Missing QORE_MNEMONIC or GRANT_VAULT_ADDRESS.');
  const account = await deriveUnifiedAccount(mnemonic);
  const window = await getWindowStatus(account.cosmos);
  if (!window.live || Number(window.remaining_txs ?? window.remainingTxs ?? 0) < 1) throw new Error('No live EVM authorisation window with a remaining transaction slot. Open a scoped window first.');
  const allowedTargets = window.allowed_targets ?? window.allowedTargets;
  if (!Array.isArray(allowedTargets) || !allowedTargets.some((x: string) => x.toLowerCase() === vault.toLowerCase())) throw new Error('The live EVM window does not confirm GrantVault in its allowed-target list. Refusing to broadcast.');
  const publicClient = createPublicClient({ chain, transport: http(EVM_RPC) });
  const privateKey = (typeof account.privateKey === 'string' ? account.privateKey : `0x${Buffer.from(account.privateKey).toString('hex')}`) as Hex;
  const wallet = privateKeyToAccount(privateKey);
  if (wallet.address.toLowerCase() !== account.evm.toLowerCase()) throw new Error('Derived EVM signer does not match the unified account.');
  const walletClient = createWalletClient({ account: wallet, chain, transport: http(EVM_RPC) });
  const appId = `0x${input.applicationId.replace(/-/g, '').padEnd(64, '0').slice(0,64)}` as Hex;
  const evidence = `0x${input.evidenceHash}` as Hex;
  const alreadyPaid = await publicClient.readContract({ address: vault, abi, functionName: 'paidApplication', args: [appId] });
  if (alreadyPaid) throw new Error('GrantVault reports that this application ID has already been paid.');
  const simulation = await publicClient.simulateContract({ account: wallet, address: vault, abi, functionName: 'payGrant', args: [appId, input.walletAddress as Address, parseEther(String(input.amountQor)), evidence] });
  const hash = await walletClient.writeContract(simulation.request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('GrantVault transaction reverted.');
  return { simulated: false, txHash: hash, blockNumber: receipt.blockNumber.toString(), explorerUrl: `https://explore.qore.network/tx/${hash}` };
}
