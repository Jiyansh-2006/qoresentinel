import { ethers } from "ethers";
import { QORECHAIN_DIANA_CONFIG } from "@qoresentinel/shared";

export class QoreChainClient {
  private provider: ethers.JsonRpcProvider;
  private networkName = QORECHAIN_DIANA_CONFIG.name;
  private chainId = QORECHAIN_DIANA_CONFIG.chainId;

  constructor(rpcUrl: string = QORECHAIN_DIANA_CONFIG.evmRpcUrl) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl, {
      chainId: this.chainId,
      name: this.networkName,
    });
  }

  public getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  public async getLatestBlockNumber(): Promise<number> {
    return this.provider.getBlockNumber();
  }

  public async getAccountBalance(address: string): Promise<{
    balanceWei: string;
    balanceQor: string;
  }> {
    const balance = await this.provider.getBalance(address);
    return {
      balanceWei: balance.toString(),
      balanceQor: ethers.formatEther(balance),
    };
  }

  public async getTransactionReceipt(txHash: string): Promise<ethers.TransactionReceipt | null> {
    try {
      return await this.provider.getTransactionReceipt(txHash);
    } catch (e) {
      return null;
    }
  }

  public getExplorerTxUrl(txHash: string): string {
    return `${QORECHAIN_DIANA_CONFIG.explorerUrl}/tx/${txHash}`;
  }

  public getExplorerAddressUrl(address: string): string {
    return `${QORECHAIN_DIANA_CONFIG.explorerUrl}/address/${address}`;
  }
}
