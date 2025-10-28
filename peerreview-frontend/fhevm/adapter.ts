export type FhevmMode = "mock" | "sepolia";

export interface EncryptedInputResult {
  handles: string[];
  inputProof: string;
}

export interface FhevmAdapter {
  mode: FhevmMode;
  init(): Promise<void>;
  createEncryptedInput(contract: string, user: string): {
    add8(v: bigint): void;
    add32(v: bigint): void;
    add64(v: bigint): void;
    encrypt(): Promise<EncryptedInputResult>;
  };
  userDecrypt?(params: {
    items: { handle: string; contractAddress: string }[];
    // 其他签名参数在 relayer 模式下由 SDK 内部处理
  }): Promise<Record<string, bigint>>;
}

export async function createAdapter(mode: FhevmMode): Promise<FhevmAdapter> {
  if (mode === "mock") {
    const { MockFhevmInstance } = await import("@fhevm/mock-utils");
    const { JsonRpcProvider } = await import("ethers");
    const rpcUrl = "http://localhost:8545";

    // 从本地 FHEVM Hardhat 节点拉取 relayer 元数据
    async function fetchRelayerMetadata(url: string): Promise<any> {
      const payload = { jsonrpc: "2.0", id: 1, method: "fhevm_relayer_metadata", params: [] };
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`fetch relayer metadata failed: ${res.status}`);
      const j = await res.json();
      if (!j?.result) throw new Error("relayer metadata missing in response");
      return j.result;
    }

    const metadata = await fetchRelayerMetadata(rpcUrl);
    const provider = new JsonRpcProvider(rpcUrl);
    const mock = await MockFhevmInstance.create(provider, provider, {
      aclContractAddress: metadata.ACLAddress,
      chainId: 31337,
      gatewayChainId: 55815,
      inputVerifierContractAddress: metadata.InputVerifierAddress,
      kmsContractAddress: metadata.KMSVerifierAddress,
      verifyingContractAddressDecryption: "0x5ffdaAB0373E62E2ea2944776209aEf29E631A64",
      verifyingContractAddressInputVerification: "0x812b06e1CDCE800494b79fFE4f925A504a9A9810",
    });
    
    return {
      mode,
      async init() {},
      createEncryptedInput(contract: string, user: string) {
        const input = mock.createEncryptedInput(contract as `0x${string}`, user as `0x${string}`);
        // 包装以转换类型
        return {
          add8: (v: bigint) => input.add8(v),
          add32: (v: bigint) => input.add32(v),
          add64: (v: bigint) => input.add64(v),
          encrypt: async () => {
            const result = await input.encrypt();
            return {
              handles: result.handles.map((h) => "0x" + Buffer.from(h).toString("hex")),
              inputProof: "0x" + Buffer.from(result.inputProof).toString("hex"),
            };
          },
        };
      },
      async userDecrypt({ items }) {
        const { userDecryptHandleBytes32 } = await import("@fhevm/mock-utils");
        const { BrowserProvider } = await import("ethers");
        const userProvider = new BrowserProvider((window as any).ethereum);
        const signer = await userProvider.getSigner();
        const pairs = items.map((i) => ({ handleBytes32: i.handle, contractAddress: i.contractAddress }));
        const res = await userDecryptHandleBytes32(mock as any, pairs, signer as any);
        // 仅返回 bigint 结果（评分为 u8）
        const out: Record<string, bigint> = {};
        for (const [k, v] of Object.entries(res)) {
          if (typeof v === "bigint") out[k] = v;
        }
        return out;
      },
    };
  }

  // sepolia + relayer
  const sdk = await import("@zama-fhe/relayer-sdk/web");
  let instance: any;

  return {
    mode,
    async init() {
      // web 版本需要先 initSDK（bundle/web 二选一，选 web 以便打包）
      // @ts-ignore
      if (sdk.initSDK) {
        // @ts-ignore
        await sdk.initSDK();
      }
      instance = await sdk.createInstance({
        // @ts-ignore
        ...sdk.SepoliaConfig,
        // 让 SDK 直接复用浏览器钱包 provider
        network: (globalThis as any).ethereum,
      });
    },
    createEncryptedInput(contract: string, user: string) {
      if (!instance) throw new Error("Relayer SDK 未初始化");
      return instance.createEncryptedInput(contract, user);
    },
    async userDecrypt({ items }) {
      if (!instance) throw new Error("Relayer SDK 未初始化");
      // 走 SDK 的 userDecrypt 简化流程（示例仅演示单个）
      const res = await instance.userDecryptSimple?.(items);
      return res ?? {};
    },
  };
}


