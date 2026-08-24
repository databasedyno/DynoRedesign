import { raw as envRaw } from "../utils/config";
import axios from "axios";

interface BCHTransactions {
  transaction_hash: string;
  index: number;
  value: number;
}

const getBitcoinCashUTXO = async (address) => {
  const { data } = await axios.get(
    `https://api.blockchair.com/bitcoin-cash/dashboards/address/${address}?transaction_details=true&key=${envRaw("BLOCKCHAIR_API_KEY")}`
  );
  const utxo: BCHTransactions[] = data?.data[address]?.utxo;
  return utxo;
};

const getAddressStatus = async (address, currency) => {
  let baseCurrency;

  if (currency === "BTC") {
    baseCurrency = "bitcoin";
  } else if (currency === "ETH") {
    baseCurrency = "ethereum";
  } else if (currency === "DOGE") {
    baseCurrency = "dogecoin";
  } else if (currency === "LTC") {
    baseCurrency = "litecoin";
  } else if (currency === "BCH") {
    baseCurrency = "bitcoin-cash";
  }
  if (baseCurrency) {
    const { data } = await axios.get(
      `https://api.blockchair.com/${baseCurrency}/dashboards/address/${address}?transaction_details=true&key=B___E6TK21VaUFalTaRHHZFIAA041zhk`
    );
    const addressDetails = data?.data[address];
    return addressDetails;
  }
};

export default { getBitcoinCashUTXO, getAddressStatus };
