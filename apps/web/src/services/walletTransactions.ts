
import { BrowserProvider, Contract, ethers } from "ethers";
import { fromBech32 } from "@cosmjs/encoding";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import {
  getQorexNative,
  hasCapability,
  qorexSignAndBroadcast,
} from "@qorechain/qorex-types";
import {
  getQoreChainNetwork,
  type QoreChainNetwork,
} from "@qoresentinel/shared";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export const DIANA_CHAIN_ID = 9800;

export const VAULT_ADDRESS =
  "0x91F56B77a284F49c1220a2B0Fe29B6f98EAfDE58";

let activeNetworkRequest: Promise<void> | null = null;
let walletConnectProviderPromise: Promise<any> | null = null;
let activeWalletProvider: any | null = null;
let activeWalletProviderType: "qorex" | "walletconnect" | null = null;
let connectRequestPromise: Promise<any> | null = null;
let mobileConnectPromise: Promise<any> | null = null;
let announcedQoreXProvider: any | null = null;
let qoreXDiscoveryPromise: Promise<any | null> | null = null;

const walletConnectProjectId =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

type WalletConnectProvider = Awaited<
  ReturnType<typeof createWalletConnectProvider>
>;

const VAULT_ABI = [
  "function createPool(bytes32 poolId,string name,string category,uint256 initialBudget,uint256 maxGrantPerApplicant,uint256 dailyCap,address tokenAddress) payable",
  "function deposit(bytes32 poolId,uint256 amount) payable",
  "function getApplication(bytes32 applicationId) view returns (bytes32 poolId,address beneficiary,uint256 totalApprovedAmount,uint256 totalPaidAmount,uint256 milestoneCount,uint256 currentMilestoneIndex,bool isCompleted,bool isCancelled)",
  "function registerApplication(bytes32 applicationId,bytes32 poolId,bytes32 decisionPayloadHash,address beneficiary,uint256 totalApprovedAmount,uint256[] milestonePercentages)",
  "function releaseGrant(bytes32 applicationId,uint256 milestoneIndex,bytes32 evidenceHash)",
];

// --------------------------------------------------
// WALLET PROVIDER DETECTION
// --------------------------------------------------

export function getQoreXProvider(): any | null {
  if (typeof window === "undefined") {
    return null;
  }

  const explicitProvider = window.qorex?.evm;
  if (explicitProvider) return explicitProvider;

  const injectedProviders = Array.isArray(
    window.ethereum?.providers
  )
    ? window.ethereum.providers
    : window.ethereum
      ? [window.ethereum]
      : [];

  return injectedProviders.find(isQoreXProvider) || announcedQoreXProvider;
}

export function getQoreXNativeProvider(): any | null {
  return getQorexNative() || null;
}

function isQoreXProvider(provider: any): boolean {
  const explicitProvider =
    typeof window !== "undefined" ? window.qorex?.evm : null;
  const name = String(provider?.info?.name || "").toLowerCase();
  const rdns = String(provider?.info?.rdns || "").toLowerCase();
  return (
    provider === explicitProvider ||
    provider === announcedQoreXProvider ||
    provider?.isQoreX === true ||
    provider?.isQorex === true ||
    provider?.isQore === true ||
    provider?.isQoreChain === true ||
    name.includes("qore") ||
    rdns.includes("qore")
  );
}

export async function discoverQoreXProvider(): Promise<any | null> {
  const existing = getQoreXProvider();
  if (existing || typeof window === "undefined") return existing;
  if (qoreXDiscoveryPromise) return qoreXDiscoveryPromise;

  qoreXDiscoveryPromise = new Promise((resolve) => {
    let completed = false;
    const finish = (provider: any | null) => {
      if (completed) return;
      completed = true;
      window.removeEventListener(
        "eip6963:announceProvider",
        handleAnnouncement as EventListener
      );
      resolve(provider);
    };
    const handleAnnouncement = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const info = detail?.info;
      const name = String(info?.name || "").toLowerCase();
      const rdns = String(info?.rdns || "").toLowerCase();
      if (detail?.provider && (name.includes("qore") || rdns.includes("qore"))) {
        announcedQoreXProvider = detail.provider;
        finish(detail.provider);
      }
    };

    window.addEventListener(
      "eip6963:announceProvider",
      handleAnnouncement as EventListener
    );
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    window.setTimeout(() => finish(null), 300);
  }).finally(() => {
    qoreXDiscoveryPromise = null;
  });

  return qoreXDiscoveryPromise;
}

// --------------------------------------------------
// WALLET CONNECT INITIALIZATION
// --------------------------------------------------

async function createWalletConnectProvider() {
  if (!walletConnectProjectId) {
    throw new Error(
      "WalletConnect Project ID is missing. Add VITE_WALLETCONNECT_PROJECT_ID to your .env file."
    );
  }

  const { default: EthereumProvider } = await import(
    "@walletconnect/ethereum-provider"
  );

  return EthereumProvider.init({
    projectId: walletConnectProjectId,

    chains: [DIANA_CHAIN_ID],

    optionalChains: [DIANA_CHAIN_ID],

    rpcMap: {
      [DIANA_CHAIN_ID]:
        "https://evm-testnet.qore.host",
    },

    showQrModal: true,

    metadata: {
      name: "QoreSentinel",

      description:
        "QoreChain Diana Testnet grant and wallet transactions",

      url: window.location.origin,

      icons: [
        `${window.location.origin}/favicon.ico`,
      ],
    },
  });
}

async function getWalletConnectProvider(): Promise<WalletConnectProvider> {
  if (!walletConnectProviderPromise) {
    walletConnectProviderPromise =
      createWalletConnectProvider().catch((error) => {
        walletConnectProviderPromise = null;
        throw error;
      });
  }

  return walletConnectProviderPromise;
}

// --------------------------------------------------
// DESKTOP / INJECTED WALLET CONNECTION
// --------------------------------------------------

export async function connectQoreXWallet(): Promise<any> {
  // Prevent duplicate simultaneous permission requests.
  if (connectRequestPromise) {
    return connectRequestPromise;
  }

  connectRequestPromise = (async () => {
    const injected = await discoverQoreXProvider();

    if (injected) {
      try {
        // Avoid opening another extension approval prompt when this origin is
        // already authorized. Repeated eth_requestAccounts calls can leave a
        // stale approval request queued in some browser wallet extensions.
        const authorizedAccounts = await injected.request({
          method: "eth_accounts",
        });
        if (authorizedAccounts?.length) {
          activeWalletProvider = injected;
          activeWalletProviderType = "qorex";
          return injected;
        }

        const accounts = await injected.request({
          method: "eth_requestAccounts",
        });

        if (!accounts || accounts.length === 0) {
          throw new Error(
            "No wallet account was authorized."
          );
        }

        activeWalletProvider = injected;
        activeWalletProviderType = "qorex";
        return injected;

      } catch (error: any) {
        if (error?.code === -32002) {
          throw new Error(
            "QoreX already has a connection approval pending. This page cannot cancel it. Open the QoreX extension from the browser toolbar and approve or reject its existing request. Then retry Connect once."
          );
        }

        if (error?.code === 4001) {
          throw new Error(
            "Wallet connection was rejected by the user."
          );
        }

        throw error;
      }
    }

    throw new Error(
      "No QoreX provider was detected in this browser. QoreSentinel did not connect to MetaMask. The QoreX “MetaMask on QoreChain” feature is a separate MetaMask-compatible wallet, not a QoreX-branded dApp provider. Use QoreX's own dApp connection option or WalletConnect if QoreX supports it."
    );
  })();

  try {
    return await connectRequestPromise;
  } finally {
    connectRequestPromise = null;
  }
}

// --------------------------------------------------
// MOBILE WALLET CONNECTION
// --------------------------------------------------

export async function connectMobileWallet(): Promise<any> {
  if (mobileConnectPromise) {
    return mobileConnectPromise;
  }

  mobileConnectPromise = (async () => {
    const provider = await getWalletConnectProvider();

    activeWalletProvider = provider;
    activeWalletProviderType = "walletconnect";

    if (!provider.session) {
      await provider.connect();
    }

    return provider;
  })();

  try {
    return await mobileConnectPromise;
  } finally {
    mobileConnectPromise = null;
  }
}

// --------------------------------------------------
// ACTIVE WALLET PROVIDER
// --------------------------------------------------

export async function getActiveWalletProvider(): Promise<any | null> {
  if (
    activeWalletProviderType === "qorex" &&
    activeWalletProvider &&
    isQoreXProvider(activeWalletProvider)
  ) {
    return activeWalletProvider;
  }

  const injected = await discoverQoreXProvider();

  if (injected) {
    activeWalletProvider = injected;
    activeWalletProviderType = "qorex";
    return injected;
  }

  if (
    activeWalletProviderType === "walletconnect" &&
    activeWalletProvider?.session
  ) {
    return activeWalletProvider;
  }

  activeWalletProvider = null;
  activeWalletProviderType = null;

  if (
    !walletConnectProjectId ||
    typeof window === "undefined"
  ) {
    return null;
  }

  const provider = await getWalletConnectProvider();

  if (provider.session) {
    activeWalletProvider = provider;
    activeWalletProviderType = "walletconnect";
  }

  return activeWalletProvider;
}

export async function getConnectedWalletAddress(): Promise<string | null> {
  const provider = await getActiveWalletProvider();

  if (!provider) {
    return null;
  }

  const accounts = await provider.request({
    method: "eth_accounts",
  });

  return accounts?.[0] || null;
}

function validateQoreXNativeAddress(address: unknown): string {
  if (typeof address !== "string") {
    throw new Error("QoreX did not return a native account address.");
  }

  let decodedAddress: ReturnType<typeof fromBech32>;
  try {
    decodedAddress = fromBech32(address, 90);
  } catch {
    throw new Error("QoreX returned an invalid QoreChain native address.");
  }

  if (decodedAddress.prefix !== "qor" || decodedAddress.data.length !== 20) {
    throw new Error("QoreX returned an invalid QoreChain native address.");
  }

  return address;
}

function getQoreXNetworkMismatchError(
  error: unknown,
  requestedNetwork: QoreChainNetwork
): Error {
  const message = error instanceof Error ? error.message : String(error);
  const mismatch = message.match(
    /chain\s+(qorechain-[a-z0-9-]+)\s+does not match the active network\s+(qorechain-[a-z0-9-]+)/i
  );

  if (!mismatch) {
    return error instanceof Error ? error : new Error(message);
  }

  const activeNetworkName =
    mismatch[2] === "qorechain-diana"
      ? "Diana Testnet"
      : mismatch[2] === "qorechain-vladi"
        ? "Mainnet"
        : mismatch[2];

  return new Error(
    `QoreX is currently on ${activeNetworkName} (${mismatch[2]}), but QoreSentinel requested ${requestedNetwork.name} (${requestedNetwork.chainId}). Switch the active network inside the QoreX extension, then reconnect or retry.`
  );
}

export async function connectQoreXNativeWallet(
  evmChainId: number
): Promise<string> {
  const network = getQoreChainNetwork(evmChainId);
  if (!network) {
    throw new Error(
      `QoreSentinel does not support native wallet connections on chain ${evmChainId}. Select Diana Testnet (9800) or Mainnet (9801).`
    );
  }

  const nativeProvider = getQorexNative();
  if (!nativeProvider?.enable || !nativeProvider.getKey) {
    throw new Error(
      "QoreX native wallet was not detected. Open QoreSentinel in the QoreX browser extension or mobile dApp browser."
    );
  }

  try {
    await nativeProvider.enable(network.chainId);
    const key = await nativeProvider.getKey(network.chainId);
    return validateQoreXNativeAddress(key?.bech32Address);
  } catch (error) {
    throw getQoreXNetworkMismatchError(error, network);
  }
}

export async function getQoreXNativeAddress(
  evmChainId: number
): Promise<string | null> {
  const nativeProvider = getQorexNative();
  const network = getQoreChainNetwork(evmChainId);

  if (!nativeProvider?.getKey || !network) {
    return null;
  }

  try {
    const key = await nativeProvider.getKey(network.chainId);
    return validateQoreXNativeAddress(key?.bech32Address);
  } catch (error) {
    throw getQoreXNetworkMismatchError(error, network);
  }
}

// --------------------------------------------------
// NETWORK MANAGEMENT
// --------------------------------------------------

export async function ensureDianaNetwork(
  provider: any
): Promise<void> {
  const chainIdHex = await provider.request({
    method: "eth_chainId",
  });

  if (
    Number.parseInt(chainIdHex, 16) === DIANA_CHAIN_ID
  ) {
    return;
  }

  if (activeNetworkRequest) {
    return activeNetworkRequest;
  }

  activeNetworkRequest = (async () => {
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",

        params: [
          {
            chainId: `0x${DIANA_CHAIN_ID.toString(16)}`,
          },
        ],
      });

    } catch (switchError: any) {
      if (switchError?.code === -32002) {
        throw new Error(
          "A network approval is already pending. Open your wallet and resolve the pending request."
        );
      }

      if (switchError?.code === 4001) {
        throw new Error(
          "QoreChain network switch was rejected."
        );
      }

      if (switchError?.code !== 4902) {
        throw switchError;
      }

      // Add Diana Testnet if it does not exist.
      try {
        await provider.request({
          method: "wallet_addEthereumChain",

          params: [
            {
              chainId: `0x${DIANA_CHAIN_ID.toString(16)}`,

              chainName: "QoreChain Diana Testnet",

              nativeCurrency: {
                name: "QOR",
                symbol: "QOR",
                decimals: 18,
              },

              rpcUrls: [
                "https://evm-testnet.qore.host",
              ],

              blockExplorerUrls: [
                "https://explore.qore.network",
              ],
            },
          ],
        });

      } catch (addError: any) {
        if (addError?.code === -32002) {
          throw new Error(
            "Network addition is already pending. Resolve the request in your wallet."
          );
        }

        throw addError;
      }

      // Verify the selected network after adding it.
      const updatedChainId = await provider.request({
        method: "eth_chainId",
      });

      if (
        Number.parseInt(updatedChainId, 16) !==
        DIANA_CHAIN_ID
      ) {
        await provider.request({
          method: "wallet_switchEthereumChain",

          params: [
            {
              chainId: `0x${DIANA_CHAIN_ID.toString(16)}`,
            },
          ],
        });
      }
    }
  })();

  try {
    await activeNetworkRequest;
  } finally {
    activeNetworkRequest = null;
  }
}

// --------------------------------------------------
// CREATE ON-CHAIN POOL
// --------------------------------------------------

export async function createOnChainPool(params: {
  onChainPoolId: string;
  title: string;
  category: string;
  totalBudgetBaseUnits: string;
  maxGrantBaseUnits: string;
  dailyCapBaseUnits: string;
}): Promise<{ txHash: string; blockNumber: number }> {
  const provider = await getActiveWalletProvider();

  if (!provider) {
    throw new Error(
      "QoreX wallet is not installed or connected."
    );
  }

  await ensureDianaNetwork(provider);

  const browserProvider = new BrowserProvider(provider);
  const signer = await browserProvider.getSigner();

  const vault = new Contract(
    VAULT_ADDRESS,
    VAULT_ABI,
    signer
  );

  const tx = await vault.createPool(
    params.onChainPoolId,
    params.title,
    params.category,
    params.totalBudgetBaseUnits,
    params.maxGrantBaseUnits,
    params.dailyCapBaseUnits,
    ethers.ZeroAddress,
    {
      value: params.totalBudgetBaseUnits,
    }
  );

  const receipt = await tx.wait();

  if (receipt?.status !== 1) {
    throw new Error(
      "On-chain pool creation transaction reverted."
    );
  }

  return {
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
  };
}

// --------------------------------------------------
// DEPOSIT INTO ON-CHAIN POOL
// --------------------------------------------------

export async function depositOnChainPool(
  onChainPoolId: string,
  amountBaseUnits: string
): Promise<{ txHash: string; blockNumber: number }> {
  const provider = await getActiveWalletProvider();

  if (!provider) {
    throw new Error(
      "QoreX wallet is not installed or connected."
    );
  }

  await ensureDianaNetwork(provider);

  const browserProvider = new BrowserProvider(provider);
  const signer = await browserProvider.getSigner();

  const vault = new Contract(
    VAULT_ADDRESS,
    VAULT_ABI,
    signer
  );

  const tx = await vault.deposit(
    onChainPoolId,
    amountBaseUnits,
    {
      value: amountBaseUnits,
    }
  );

  const receipt = await tx.wait();

  if (receipt?.status !== 1) {
    throw new Error(
      "On-chain pool deposit transaction reverted."
    );
  }

  return {
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
  };
}

// --------------------------------------------------
// QOR TRANSFER
// --------------------------------------------------

export async function sendQorTransfer(
  toAddress: string,
  amountQor: string,
  evmChainId: number
): Promise<{
  txHash: string;
  blockNumber: number;
  fromAddress: string;
  toAddress: string;
  amountBaseUnits: string;
  amountDecimals: number;
  amountDenom: string;
  network: string;
  chainId: number;
}> {
  let decodedRecipient: ReturnType<typeof fromBech32>;
  try {
    decodedRecipient = fromBech32(toAddress, 90);
  } catch {
    throw new Error(
      "Recipient must be a valid QoreChain qor1 native address."
    );
  }

  if (decodedRecipient.prefix !== "qor" || decodedRecipient.data.length !== 20) {
    throw new Error(
      "Recipient must be a QoreChain qor1 address with a 20-byte account payload."
    );
  }

  const nativeProvider = getQorexNative();
  if (!nativeProvider?.enable || !nativeProvider.getKey) {
    throw new Error(
      "QoreX native signing is unavailable. Open QoreSentinel in the QoreX browser extension or mobile dApp browser."
    );
  }

  if (!hasCapability(nativeProvider, "signAndBroadcast")) {
    throw new Error(
      "This QoreX version does not support native dApp transactions. Update QoreX and retry."
    );
  }

  const network = getQoreChainNetwork(evmChainId);

  if (!network) {
    throw new Error(
      `QoreSentinel does not support native transfers on chain ${evmChainId}. Select Diana Testnet (9800) or Mainnet (9801).`
    );
  }

  let account;
  try {
    await nativeProvider.enable(network.chainId);
    account = await nativeProvider.getKey(network.chainId);
  } catch (error) {
    throw getQoreXNetworkMismatchError(error, network);
  }
  const fromAddress = validateQoreXNativeAddress(account?.bech32Address);

  const amountBaseUnits = ethers.parseUnits(amountQor, 6).toString();
  if (BigInt(amountBaseUnits) <= 0n) {
    throw new Error("Transfer amount must be greater than zero.");
  }

  const message = MsgSend.encode({
    fromAddress,
    toAddress,
    amount: [{ denom: "uqor", amount: amountBaseUnits }],
  }).finish();

  const result = await qorexSignAndBroadcast(
    {
      chainId: network.chainId,
      messages: [
        {
          typeUrl: MsgSend.typeUrl,
          value: message,
        },
      ],
      memo: "",
      gasLimit: 400_000,
    },
    { native: nativeProvider }
  );

  if (result.code !== 0) {
    throw new Error(
      `QoreX reported native transfer failure (code ${result.code}, tx ${result.txHash}).`
    );
  }

  return {
    txHash: result.txHash,
    blockNumber: result.height ?? 0,
    fromAddress,
    toAddress,
    amountBaseUnits,
    amountDecimals: 6,
    amountDenom: "uqor",
    network: network.name,
    chainId: network.evmChainId,
  };
}

// --------------------------------------------------
// APPROVED GRANT EXECUTION
// --------------------------------------------------

export async function executeApprovedGrantWalletTransaction(
  params: {
    applicationId: string;
    poolId: string;
    beneficiary: string;
    approvedAmountBaseUnits: string;
    milestonePercentages: number[];
    milestoneIndex: number;
    evidenceRootHash: string;
    decisionPayload: unknown;
  }
): Promise<{
  registrationTxHash?: string;
  releaseTxHash: string;
  blockNumber: number;
  gasUsed: string;
}> {
  const provider = await getActiveWalletProvider();

  if (!provider) {
    throw new Error(
      "QoreX wallet is not installed or connected."
    );
  }

  await ensureDianaNetwork(provider);

  const browserProvider = new BrowserProvider(provider);
  const signer = await browserProvider.getSigner();

  const vault = new Contract(
    VAULT_ADDRESS,
    VAULT_ABI,
    signer
  );

  const appId = ethers.keccak256(
    ethers.toUtf8Bytes(params.applicationId)
  );

  const poolId =
    params.poolId.startsWith("0x") &&
    params.poolId.length === 66
      ? params.poolId
      : ethers.keccak256(
          ethers.toUtf8Bytes(params.poolId)
        );

  const decisionHash = ethers.keccak256(
    ethers.toUtf8Bytes(
      JSON.stringify(params.decisionPayload)
    )
  );

  const evidenceHash =
    params.evidenceRootHash.length === 66
      ? params.evidenceRootHash
      : ethers.zeroPadValue(
          ethers.toBeHex(params.evidenceRootHash),
          32
        );

  let registrationTxHash: string | undefined;

  const existing = await vault.getApplication(appId);

  if (existing.poolId === ethers.ZeroHash) {
    const registration = await vault.registerApplication(
      appId,
      poolId,
      decisionHash,
      params.beneficiary,
      params.approvedAmountBaseUnits,
      params.milestonePercentages
    );

    const registrationReceipt = await registration.wait();

    if (registrationReceipt?.status !== 1) {
      throw new Error(
        "Grant registration transaction reverted."
      );
    }

    registrationTxHash = registration.hash;
  }

  const release = await vault.releaseGrant(
    appId,
    params.milestoneIndex,
    evidenceHash
  );

  const releaseReceipt = await release.wait();

  if (releaseReceipt?.status !== 1) {
    throw new Error(
      "Grant release transaction reverted."
    );
  }

  return {
    registrationTxHash,
    releaseTxHash: release.hash,
    blockNumber: releaseReceipt.blockNumber,
    gasUsed: releaseReceipt.gasUsed.toString(),
  };
}
