import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import styles from "./balance.module.css";

interface BalanceResponse {
  account_id: number;
  credit_monthly: number;
  credit_package: number;
}

interface BalanceApiResponse {
  Resp?: BalanceResponse;
}

export default function Balance({ apiKey }: { apiKey: string }) {
  const [balance, setBalance] = useState<BalanceResponse | null>(null);

  const fetchBalance = async (): Promise<void> => {
    try {
      const response = await fetch("/pixelapi/openapi/v2/account/balance", {
        method: "GET",
        headers: {
          "API-KEY": apiKey,
          "AI-trace-ID": uuidv4(),
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        referrerPolicy: "no-referrer",
      });

      if (!response.ok) {
        console.error("Failed to fetch balance:", response.status, response.statusText);
        return;
      }

      const data = (await response.json()) as unknown as BalanceApiResponse;
      if (data?.Resp) {
        setBalance(data.Resp);
      }
    } catch (err) {
      console.error("fetchBalance() error", err);
    }
  };

  useEffect(() => {
    void fetchBalance(); // initial load
    const intervalId = setInterval(() => {
      void fetchBalance();
    }, 600000);
    return () => clearInterval(intervalId);
  }, [apiKey]);

  return (
    <div className={styles.balance_container}>
      {balance ? (
        <div>
          <p>Monthly Credit: {balance.credit_monthly}</p>
          <p>Package Credit: {balance.credit_package}</p>
        </div>
      ) : (
        <p>Loading balance...</p>
      )}
    </div>
  );
}
