import { ethers } from "ethers";
import { addresses } from "../abi/addresses";

export type NetworkKey = keyof typeof addresses; // e.g. "localhost" | "sepolia"

export function getAddress(network: NetworkKey, name: keyof (typeof addresses)[NetworkKey]) {
  return addresses[network][name as any] as `0x${string}`;
}

export async function getContract(providerOrSigner: any, network: NetworkKey, name: string) {
  const abi = await import(`../abi/${name}.json`).then((m) => m.default);
  const addr = (addresses as any)[network]?.[name];
  if (!addr) throw new Error(`缺少 ${name} 在 ${network} 的地址映射`);
  return new ethers.Contract(addr, abi, providerOrSigner);
}





