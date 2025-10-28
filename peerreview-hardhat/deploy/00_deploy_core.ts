import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, log } = hre.deployments;

  const paper = await deploy("PaperRegistry", { from: deployer, log: true });
  log(`PaperRegistry deployed at ${paper.address}`);

  const review = await deploy("ReviewManager", { from: deployer, log: true });
  log(`ReviewManager deployed at ${review.address}`);

  const reward = await deploy("RewardPool", { from: deployer, log: true });
  log(`RewardPool deployed at ${reward.address}`);

  const vote = await deploy("VoteContract", { from: deployer, log: true });
  log(`VoteContract deployed at ${vote.address}`);
};

export default func;
func.id = "deploy_core";
func.tags = ["core"];



