
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";

import {
  getActiveWalletProvider,
  getQoreXProvider,
  connectQoreXWallet,
  connectQoreXNativeWallet,
  connectMobileWallet as connectMobileWalletProvider,
  getQoreXNativeAddress,
} from "../services/walletTransactions.js";
import { getQoreChainNetwork } from "@qoresentinel/shared";
import { api } from "../services/api.js";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

interface WalletContextType {
  isConnected: boolean;
  nativeConnected: boolean;
  address: string | null;
  nativeAddress: string | null;
  network: string;
  chainId: number;
  nativeNetwork: string;
  nativeChainId: number;
  balance: string;
  nativeBalance: string | null;
  nativeBalanceLoading: boolean;
  nativeBalanceError: string | null;
  isPqcRegistered: boolean;
  fingerprint: string | null;
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  connectWallet: () => Promise<void>;
  connectNativeWallet: (chainId?: number) => Promise<void>;
  selectNativeNetwork: (chainId: number) => void;
  connectMobileWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshWalletData: () => Promise<void>;
}

const WalletContext =
  createContext<WalletContextType | undefined>(undefined);

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const DEFAULT_CHAIN_ID = 9800;

const getNetworkName = (chainId: number): string => {
  return getQoreChainNetwork(chainId)?.name ?? `Unsupported EVM Chain ${chainId}`;
};

function isMobileDevice(): boolean {
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function openCurrentSiteInQoreX(): void {
  const pageUrl = new URL(`${window.location.origin}${window.location.pathname}`);
  const isIpAddress = /^\d{1,3}(\.\d{1,3}){3}$/.test(pageUrl.hostname) || pageUrl.hostname.includes(":");
  if (
    pageUrl.protocol !== "https:" ||
    pageUrl.port ||
    pageUrl.username ||
    pageUrl.password ||
    pageUrl.hostname === "localhost" ||
    pageUrl.hostname.endsWith(".localhost") ||
    isIpAddress ||
    pageUrl.href.length > 2048
  ) {
    throw new Error("Open QoreSentinel at a public HTTPS website address, then tap Connect EVM again. QoreX mobile cannot connect to localhost or a local network address.");
  }

  const qorexBrowseUrl = new URL("https://link.qore.network/browse");
  qorexBrowseUrl.searchParams.set("url", pageUrl.href);
  window.location.assign(qorexBrowseUrl.toString());
}

const parseChainId = (chainId: string | number): number => {
  if (typeof chainId === "number") {
    return chainId;
  }

  return chainId.startsWith("0x")
    ? Number.parseInt(chainId, 16)
    : Number.parseInt(chainId, 10);
};

// --------------------------------------------------
// WALLET PROVIDER
// --------------------------------------------------

export const WalletProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [nativeConnected, setNativeConnected] = useState(false);

  const [address, setAddress] = useState<string | null>(
    null
  );

  const [nativeAddress, setNativeAddress] = useState<string | null>(null);

  const [network, setNetwork] = useState(
    "QoreChain Diana Testnet"
  );

  const [chainId, setChainId] = useState(
    DEFAULT_CHAIN_ID
  );
  const [nativeChainId, setNativeChainId] = useState(DEFAULT_CHAIN_ID);
  const [nativeNetwork, setNativeNetwork] = useState(getNetworkName(DEFAULT_CHAIN_ID));

  const [balance, setBalance] = useState("0 QOR");
  const [nativeBalance, setNativeBalance] = useState<string | null>(null);
  const [nativeBalanceLoading, setNativeBalanceLoading] = useState(false);
  const [nativeBalanceError, setNativeBalanceError] = useState<string | null>(null);

  const [isPqcRegistered] = useState(false);

  const [fingerprint] = useState<string | null>(null);

  const [isDemoMode, setIsDemoMode] = useState(() => {
    return (
      typeof window !== "undefined" &&
      localStorage.getItem("qoresentinel_live_mode") !==
        "true"
    );
  });

  // Prevent repeated wallet connection requests.
  const connectionInProgress = useRef(false);
  const nativeBalanceRequestId = useRef(0);
  const nativeChainIdRef = useRef(DEFAULT_CHAIN_ID);
  const nativeConnectedRef = useRef(false);

  // Prevent state updates after component unmount.
  const mounted = useRef(true);

  // --------------------------------------------------
  // DEMO MODE
  // --------------------------------------------------

  const toggleDemoMode = () => {
    setIsDemoMode((previous) => {
      const next = !previous;

      localStorage.setItem(
        "qoresentinel_live_mode",
        next ? "false" : "true"
      );

      return next;
    });
  };

  const updateNativeConnectionState = (connected: boolean) => {
    nativeConnectedRef.current = connected;
    setNativeConnected(connected);
  };

  // --------------------------------------------------
  // REFRESH WALLET INFORMATION
  // --------------------------------------------------

  const refreshWallet = async (
    provider: any,
    walletAddress: string
  ): Promise<number> => {
    if (!mounted.current) return chainId;

    setAddress(walletAddress);
    setIsConnected(true);

    const currentChainId = parseChainId(
      await provider.request({
        method: "eth_chainId",
      })
    );

    if (!mounted.current) return currentChainId;

    setChainId(currentChainId);
    setNetwork(getNetworkName(currentChainId));

    const rawBalance = await provider.request({
      method: "eth_getBalance",
      params: [walletAddress, "latest"],
    });

    if (!mounted.current) return currentChainId;

    const wei = BigInt(rawBalance);

    const qor = Number(wei) / 1e18;

    setBalance(`${qor.toFixed(4)} QOR`);
    return currentChainId;
  };

  // --------------------------------------------------
  // CLEAR WALLET STATE
  // --------------------------------------------------

  const clearEvmWalletState = () => {
    if (!mounted.current) return;

    setAddress(null);
    setIsConnected(false);
    setBalance("0 QOR");
  };

  const clearWalletState = () => {
    if (!mounted.current) return;

    clearEvmWalletState();
    updateNativeConnectionState(false);
    setNativeAddress(null);
    nativeBalanceRequestId.current += 1;
    setNativeBalance(null);
    setNativeBalanceLoading(false);
    setNativeBalanceError(null);
  };

  const selectNativeNetwork = (selectedChainId: number) => {
    const selectedNetwork = getQoreChainNetwork(selectedChainId);
    if (!selectedNetwork) {
      throw new Error(
        "Select QoreChain Diana Testnet (9800) or Mainnet (9801)."
      );
    }

    if (selectedChainId === nativeChainIdRef.current) return;

    nativeChainIdRef.current = selectedChainId;
    setNativeChainId(selectedChainId);
    setNativeNetwork(selectedNetwork.name);
    nativeBalanceRequestId.current += 1;
    updateNativeConnectionState(false);
    setNativeAddress(null);
    setNativeBalance(null);
    setNativeBalanceLoading(false);
    setNativeBalanceError(null);
  };

  const refreshNativeAddress = async (
    nativeEvmChainId: number,
    knownAddress?: string
  ): Promise<string | null> => {
    const requestId = ++nativeBalanceRequestId.current;
    try {
      const currentAddress =
        knownAddress ?? (await getQoreXNativeAddress(nativeEvmChainId));
      if (!mounted.current || requestId !== nativeBalanceRequestId.current) {
        return currentAddress;
      }

      setNativeAddress(currentAddress);
      updateNativeConnectionState(Boolean(currentAddress));
      setNativeBalanceError(null);

      if (!currentAddress) {
        updateNativeConnectionState(false);
        setNativeBalance(null);
        setNativeBalanceLoading(false);
        return null;
      }

      const currentNetwork = getQoreChainNetwork(nativeEvmChainId);
      if (currentNetwork) {
        nativeChainIdRef.current = nativeEvmChainId;
        setNativeChainId(nativeEvmChainId);
        setNativeNetwork(currentNetwork.name);
      }

      setNativeBalanceLoading(true);
      try {
        const currentBalance = await api.getNativeBalance(currentAddress, nativeEvmChainId);
        if (mounted.current && requestId === nativeBalanceRequestId.current) {
          setNativeBalance(currentBalance.amountBaseUnits);
        }
      } catch (error) {
        if (mounted.current && requestId === nativeBalanceRequestId.current) {
          setNativeBalance(null);
          setNativeBalanceError(
            error instanceof Error ? error.message : "Native balance lookup failed."
          );
        }
        console.warn("Could not read the QoreX native balance:", error);
      } finally {
        if (mounted.current && requestId === nativeBalanceRequestId.current) {
          setNativeBalanceLoading(false);
        }
      }

      return currentAddress;
    } catch (error) {
      if (mounted.current && requestId === nativeBalanceRequestId.current) {
        updateNativeConnectionState(false);
        setNativeAddress(null);
        setNativeBalance(null);
        setNativeBalanceError(
          error instanceof Error ? error.message : "Native account lookup failed."
        );
        setNativeBalanceLoading(false);
      }
      console.warn("Could not read the QoreX native account address:", error);
      return null;
    }
  };

  const refreshWalletData = async (): Promise<void> => {
    const provider = await getActiveWalletProvider();
    if (!provider) {
      if (nativeConnectedRef.current) {
        await refreshNativeAddress(nativeChainIdRef.current);
        return;
      }
      throw new Error("Connect a QoreX wallet before refreshing wallet data.");
    }

    const accounts = await provider.request({ method: "eth_accounts" });
    if (!accounts?.[0]) {
      clearEvmWalletState();
      if (nativeConnectedRef.current) {
        await refreshNativeAddress(nativeChainIdRef.current);
        return;
      }
      throw new Error("The connected wallet has no authorized EVM account.");
    }

    await refreshWallet(provider, accounts[0]);
    if (nativeConnectedRef.current) {
      await refreshNativeAddress(nativeChainIdRef.current);
    }
  };

  // --------------------------------------------------
  // AUTOMATIC WALLET DETECTION
  // --------------------------------------------------

  useEffect(() => {
    mounted.current = true;

    let provider: any = null;

    const handleAccountsChanged = (
      accounts: string[]
    ) => {
      if (accounts?.[0]) {
        refreshWallet(provider, accounts[0])
          .then(() =>
            nativeConnectedRef.current
              ? refreshNativeAddress(nativeChainIdRef.current)
              : null
          )
          .catch((error) => {
            console.error(
              "Failed to refresh wallet account:",
              error
            );
          });
      } else {
        clearEvmWalletState();
      }
    };

    const handleChainChanged = (
      newChainId: string
    ) => {
      const currentChainId = parseChainId(
        newChainId
      );

      if (!mounted.current) return;

      setChainId(currentChainId);
      setNetwork(getNetworkName(currentChainId));
      if (nativeConnectedRef.current) {
        refreshNativeAddress(nativeChainIdRef.current);
      }
    };

    const handleWindowFocus = () => {
      getActiveWalletProvider()
        .then(async (activeProvider) => {
          if (!activeProvider || !mounted.current) return;
          provider = activeProvider;
          const accounts = await activeProvider.request({
            method: "eth_accounts",
          });
          if (!accounts?.[0]) {
            clearEvmWalletState();
            return;
          }
          await refreshWallet(activeProvider, accounts[0]);
          if (nativeConnectedRef.current) {
            await refreshNativeAddress(nativeChainIdRef.current);
          }
        })
        .catch((error) => {
          console.error("Failed to refresh wallet after returning to the app:", error);
        });
    };

    const initializeWallet = async () => {
      try {
        const walletProvider =
          await getActiveWalletProvider();

        if (!walletProvider || !mounted.current) {
          clearEvmWalletState();
          return;
        }

        provider = walletProvider;

        // Listen for account changes.
        provider.on?.(
          "accountsChanged",
          handleAccountsChanged
        );

        // Listen for network changes.
        provider.on?.(
          "chainChanged",
          handleChainChanged
        );

        // Check existing authorized accounts.
        const accounts = await provider.request({
          method: "eth_accounts",
        });

        if (!mounted.current) return;

        if (accounts?.[0]) {
          await refreshWallet(provider, accounts[0]);
          if (nativeConnectedRef.current) {
            await refreshNativeAddress(nativeChainIdRef.current);
          }
        }
      } catch (error) {
        console.error(
          "Wallet initialization failed:",
          error
        );
      }
    };

    initializeWallet();
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      mounted.current = false;
      window.removeEventListener("focus", handleWindowFocus);

      if (provider) {
        provider.removeListener?.(
          "accountsChanged",
          handleAccountsChanged
        );

        provider.removeListener?.(
          "chainChanged",
          handleChainChanged
        );
      }
    };
  }, []);

  // --------------------------------------------------
  // CONNECT DESKTOP WALLET
  // --------------------------------------------------

  const connectWallet = async (): Promise<void> => {
    if (connectionInProgress.current) {
      return;
    }

    connectionInProgress.current = true;
    clearEvmWalletState();

    try {
      // QoreX mobile injects its EVM provider only inside its own dApp browser.
      // From a regular mobile browser, open this site in that browser first.
      if (isMobileDevice() && !getQoreXProvider()) {
        openCurrentSiteInQoreX();
        return;
      }

      const provider = await connectQoreXWallet();

      const accounts = await provider.request({
        method: "eth_accounts",
      });

      if (!accounts?.[0]) {
        throw new Error(
          "No QoreX account was returned. Please approve the connection in your wallet."
        );
      }

      await refreshWallet(provider, accounts[0]);

      const nativeAccountAddress = nativeConnectedRef.current
        ? await refreshNativeAddress(nativeChainIdRef.current)
        : null;
      console.log(
        "QoreX wallet connected:",
        {
          nativeAddress: nativeAccountAddress,
          evmAddress: accounts[0],
        }
      );

    } catch (error: any) {
      const approvalPending =
        error?.code === -32002 ||
        error?.message?.includes("connection approval pending");

      if (!approvalPending) {
        console.error("QoreX wallet connection failed:", error);
      }

      throw error;

    } finally {
      connectionInProgress.current = false;
    }
  };

  // --------------------------------------------------
  // CONNECT NATIVE QOREX WALLET
  // --------------------------------------------------

  const connectNativeWallet = async (
    selectedChainId = nativeChainIdRef.current
  ): Promise<void> => {
    if (connectionInProgress.current) {
      return;
    }

    connectionInProgress.current = true;

    try {
      selectNativeNetwork(selectedChainId);
      const currentAddress = await connectQoreXNativeWallet(selectedChainId);
      if (!mounted.current) return;

      setNativeAddress(currentAddress);
      updateNativeConnectionState(true);
      setNativeBalanceError(null);
      await refreshNativeAddress(selectedChainId, currentAddress);
      console.log("QoreX native wallet connected:", currentAddress);
    } catch (error) {
      console.error("QoreX native wallet connection failed:", error);
      throw error;
    } finally {
      connectionInProgress.current = false;
    }
  };

  // --------------------------------------------------
  // CONNECT MOBILE WALLET
  // --------------------------------------------------

  const connectMobileWallet = async (): Promise<void> => {
    if (connectionInProgress.current) {
      return;
    }

    connectionInProgress.current = true;

    try {
      const provider =
        await connectMobileWalletProvider();

      const accounts = await provider.request({
        method: "eth_accounts",
      });

      if (!accounts?.[0]) {
        throw new Error(
          "QoreX did not return an account. Approve the connection in your mobile wallet."
        );
      }

      await refreshWallet(
        provider,
        accounts[0]
      );

      nativeBalanceRequestId.current += 1;
      setNativeAddress(null);
      updateNativeConnectionState(false);
      setNativeBalance(null);
      setNativeBalanceError(null);
      setNativeBalanceLoading(false);
      console.log(
        "QoreX mobile EVM wallet connected:",
        accounts[0]
      );

    } catch (error: any) {
      console.error(
        "Mobile wallet connection failed:",
        error
      );

      throw error;

    } finally {
      connectionInProgress.current = false;
    }
  };

  // --------------------------------------------------
  // DISCONNECT WALLET FROM APPLICATION STATE
  // --------------------------------------------------

  const disconnectWallet = () => {
    clearWalletState();

    console.log(
      "Wallet disconnected from QoreSentinel application."
    );
  };

  // --------------------------------------------------
  // CONTEXT PROVIDER
  // --------------------------------------------------

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        nativeConnected,
        address,
        nativeAddress,
        network,
        chainId,
        nativeNetwork,
        nativeChainId,
        balance,
        nativeBalance,
        nativeBalanceLoading,
        nativeBalanceError,
        isPqcRegistered,
        fingerprint,
        isDemoMode,
        toggleDemoMode,
        connectWallet,
        connectNativeWallet,
        selectNativeNetwork,
        connectMobileWallet,
        disconnectWallet,
        refreshWalletData,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

// --------------------------------------------------
// CUSTOM WALLET HOOK
// --------------------------------------------------

export const useWallet = () => {
  const context = useContext(WalletContext);

  if (!context) {
    throw new Error(
      "useWallet must be used within a WalletProvider"
    );
  }

  return context;
};
