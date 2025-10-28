import fs from "fs";
import path from "path";

const root = path.resolve(process.cwd());
const hardhatDeployRoot = path.resolve(root, "../peerreview-hardhat/deployments");
const outAbiDir = path.resolve(root, "abi");

const contracts = [
  "PaperRegistry",
  "ReviewManager",
  "RewardPool",
  "VoteContract",
];

/** Read deployments for each network and generate abi json + addresses.ts */
function main() {
  if (!fs.existsSync(hardhatDeployRoot)) {
    console.error("deployments 目录不存在:", hardhatDeployRoot);
    process.exit(1);
  }

  fs.mkdirSync(outAbiDir, { recursive: true });

  const networks = fs
    .readdirSync(hardhatDeployRoot)
    .filter((n) => fs.statSync(path.join(hardhatDeployRoot, n)).isDirectory());

  const addresses = {};

  for (const net of networks) {
    const addrMap = {};
    for (const name of contracts) {
      const f = path.join(hardhatDeployRoot, net, `${name}.json`);
      if (!fs.existsSync(f)) continue;
      const json = JSON.parse(fs.readFileSync(f, "utf-8"));
      // write abi file (one per contract)
      const abiOut = path.join(outAbiDir, `${name}.json`);
      fs.writeFileSync(abiOut, JSON.stringify(json.abi, null, 2));
      addrMap[name] = json.address;
    }
    if (Object.keys(addrMap).length) {
      addresses[net] = addrMap;
    }
  }

  const ts = `// 自动生成，来源: peerreview-hardhat/deployments\nexport const addresses = ${JSON.stringify(
    addresses,
    null,
    2
  )} as const;\n`;
  fs.writeFileSync(path.join(outAbiDir, "addresses.ts"), ts);

  console.log("ABI 与地址已同步到:", outAbiDir);
}

main();








