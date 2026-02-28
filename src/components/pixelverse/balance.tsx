import { useEffect, useState } from "react";
import type { ProviderBalance, VideoProviderAdapter } from "../../platform/video-provider-adapter.js";
import styles from "./balance.module.css";

export interface BalanceProps {
  apiKey: string;
  adapter: VideoProviderAdapter;
  refreshMs?: number;
}

export default function Balance({ apiKey, adapter, refreshMs = 600000 }: BalanceProps) {
  const [balance, setBalance] = useState<ProviderBalance | null>(null);

  const fetchBalance = async (): Promise<void> => {
    if (!adapter.getBalance) {
      setBalance({ monthlyCredit: 0, packageCredit: 0 });
      return;
    }

    try {
      const value = await adapter.getBalance({
        apiKey,
        traceId: crypto.randomUUID(),
      });
      setBalance(value);
    } catch (err) {
      console.error("fetchBalance() error", err);
    }
  };

  useEffect(() => {
    void fetchBalance();
    const intervalId = setInterval(() => {
      void fetchBalance();
    }, refreshMs);

    return () => clearInterval(intervalId);
  }, [apiKey, adapter, refreshMs]);

  return (
    <div className={styles.balance_container}>
      {balance ? (
        <div>
          <p>Monthly Credit: {balance.monthlyCredit}</p>
          <p>Package Credit: {balance.packageCredit}</p>
        </div>
      ) : (
        <p>Loading balance...</p>
      )}
    </div>
  );
}
