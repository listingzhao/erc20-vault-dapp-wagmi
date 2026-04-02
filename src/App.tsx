import { useMemo, useState, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useBalance, useChainId, useReadContract } from "wagmi";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { formatUnits } from "viem";
import { BANK_ADDRESS, TOKEN_ADDRESS, bankAbi, erc20Abi } from "./contracts";
import "./App.css";

function formatAddress(addr?: `0x${string}`) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function App() {
  const [approveAmount, setApproveAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState("");
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const isSepolia = chainId === 11155111;

  const { data: ethBalance } = useBalance({
    address,
  });

  const { data: tokenSymbol } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "symbol",
    query: {
      enabled: isConnected && isSepolia,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
  });

  const { data: tokenDecimals } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "decimals",
    query: {
      enabled: isConnected && isSepolia,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
  });

  const decimals = Number(tokenDecimals ?? 18);

  const { data: tokenBalanceRaw, refetch: refetchTokenBalance } =
    useReadContract({
      address: TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: address ? [address] : undefined,
      query: {
        enabled: Boolean(address && isSepolia),
        refetchOnMount: true,
        refetchOnReconnect: true,
      },
    });

  const { data: allowanceRaw, refetch: refetchAllowance } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, BANK_ADDRESS] : undefined,
    query: {
      enabled: Boolean(address && isSepolia),
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
  });

  const { data: userDepositRaw, refetch: refetchDeposit } = useReadContract({
    address: BANK_ADDRESS,
    abi: bankAbi,
    functionName: "deposits",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address && isSepolia),
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
  });

  const { data: bankBalanceRaw, refetch: refetchBankBalance } = useReadContract(
    {
      address: BANK_ADDRESS,
      abi: bankAbi,
      functionName: "getContractTokenBalance",
      query: {
        enabled: isConnected && isSepolia,
        refetchOnMount: true,
        refetchOnReconnect: true,
      },
    },
  );

  const tokenBalance = useMemo(() => {
    if (tokenBalanceRaw == null) return "N/A";
    return formatUnits(tokenBalanceRaw, decimals);
  }, [tokenBalanceRaw, decimals]);

  const allowance = useMemo(() => {
    if (allowanceRaw == null) return "N/A";
    return formatUnits(allowanceRaw, decimals);
  }, [allowanceRaw, decimals]);

  const userDeposit = useMemo(() => {
    if (userDepositRaw == null) return "N/A";
    return formatUnits(userDepositRaw, decimals);
  }, [userDepositRaw, decimals]);

  const bankBalance = useMemo(() => {
    if (bankBalanceRaw == null) return "N/A";
    return formatUnits(bankBalanceRaw, decimals);
  }, [bankBalanceRaw, decimals]);

  const { writeContractAsync } = useWriteContract();
  const [activeAction, setActiveAction] = useState<
    "approve" | "deposit" | null
  >(null);

  const handleApprove = async () => {
    if (!address || !approveAmount) return;
    if (!isSepolia) {
      setError("Wrong network");
      return;
    }

    try {
      setError("");
      setActiveAction("approve");

      const amount = parseUnits(approveAmount, decimals);

      const hash = await writeContractAsync({
        address: TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [BANK_ADDRESS, amount],
      });

      setTxHash(hash);
    } catch (err: any) {
      if (err?.name === "UserRejectedRequestError") {
        setError("User rejected transaction");
      } else {
        setError("Approve failed");
      }
    } finally {
      setActiveAction(null);
    }
  };

  const handleDeposit = async () => {
    if (!address || !depositAmount) return;
    if (!isSepolia) {
      setError("Wrong network");
      return;
    }

    if (Number(allowance) < Number(depositAmount)) {
      setError("Insufficient allowance, please approve first");
      return;
    }

    try {
      setError("");
      setActiveAction("deposit");

      const amount = parseUnits(depositAmount, decimals);

      const hash = await writeContractAsync({
        address: BANK_ADDRESS,
        abi: bankAbi,
        functionName: "deposit",
        args: [amount],
      });

      setTxHash(hash);
    } catch (err: any) {
      if (err?.name === "UserRejectedRequestError") {
        setError("User rejected transaction");
      } else {
        setError("Deposit failed");
      }
    } finally {
      setActiveAction(null);
    }
  };

  const approveButtonText =
    activeAction === "approve"
      ? isConfirming
        ? "Confirming..."
        : "Submitting..."
      : "Approve";

  const depositButtonText =
    activeAction === "deposit"
      ? isConfirming
        ? "Confirming..."
        : "Submitting..."
      : "Deposit";

  useEffect(() => {
    if (isSuccess) {
      refetchTokenBalance();
      refetchAllowance();
      refetchDeposit();
      refetchBankBalance();
    }
  }, [isSuccess]);
  return (
    <div
      style={{
        maxWidth: "760px",
        margin: "40px auto",
        padding: "32px",
        border: "1px solid #ddd",
        borderRadius: "16px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1 style={{ marginTop: 0 }}>ERC20 Vault DApp</h1>
      <p>Connect wallet, approve ERC20 tokens, and deposit into a vault.</p>
      <p>Demonstrates the core DeFi flow: approve → transferFrom → deposit.</p>

      <div style={{ marginTop: 20, marginBottom: 20 }}>
        <ConnectButton />
      </div>

      {isConnected && !isSepolia && (
        <div
          style={{
            padding: "12px 16px",
            background: "#fff3cd",
            color: "#856404",
            borderRadius: "8px",
            marginBottom: "16px",
          }}
        >
          Wrong network, please switch to Sepolia.
        </div>
      )}

      <div style={{ lineHeight: 1.8 }}>
        <p>
          <strong>Wallet:</strong>{" "}
          {isConnected && address ? formatAddress(address) : "Not connected"}
        </p>
        <p>
          <strong>Chain ID:</strong> {chainId || "N/A"}
        </p>
        <p>
          <strong>ETH Balance:</strong>{" "}
          {ethBalance ? `${ethBalance.formatted} ${ethBalance.symbol}` : "N/A"}
        </p>
        <p>
          <strong>{tokenSymbol ?? "Token"} Balance:</strong> {tokenBalance}
        </p>
        <p>
          <strong>Allowance to Bank:</strong> {allowance}
        </p>
        <p>
          <strong>My Deposit:</strong> {userDeposit}
        </p>
        <p>
          <strong>Vault Balance:</strong> {bankBalance}
        </p>
      </div>

      <div style={{ marginTop: 30 }}>
        <h3>Approve</h3>
        <input
          placeholder={`Amount (${tokenSymbol ?? "TOKEN"})`}
          value={approveAmount}
          onChange={(e) => setApproveAmount(e.target.value)}
          style={{
            display: "block",
            marginBottom: 10,
            width: 320,
            padding: 10,
          }}
        />
        <button
          onClick={handleApprove}
          disabled={!isConnected || !approveAmount || activeAction !== null}
        >
          {approveButtonText}
        </button>
      </div>

      <div style={{ marginTop: 30 }}>
        <h3>Deposit</h3>
        <input
          placeholder="Deposit amount"
          value={depositAmount}
          onChange={(e) => setDepositAmount(e.target.value)}
          style={{
            display: "block",
            marginBottom: 10,
            width: 320,
            padding: 10,
          }}
        />
        <button
          onClick={handleDeposit}
          disabled={!isConnected || !depositAmount || activeAction !== null}
        >
          {depositButtonText}
        </button>
        {txHash && isConfirming && <p>⛏️ Waiting for confirmation...</p>}

        {txHash && isSuccess && <p>✅ Transaction confirmed</p>}

        {error && <p style={{ color: "red" }}>❌ {error}</p>}

        {txHash && (
          <a
            href={`https://sepolia.etherscan.io/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            View on Etherscan
          </a>
        )}
      </div>
    </div>
  );
}

export default App;
