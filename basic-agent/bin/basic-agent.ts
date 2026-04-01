#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import * as fs from 'fs';
import * as path from 'path';
import { BedrockStack } from '../lib/bedrock-stack';
import { AgentCoreStack } from '../lib/agentcore-stack';

const app = new cdk.App();

const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../config/config.json'), 'utf-8')
);
const tags = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../config/tags.json'), 'utf-8')
);

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const bedrockStack = new BedrockStack(app, 'BedrockStack', {
  prefix: config.prefix,
  inferenceProfileId: config.inferenceProfile,
  env,
});

const agentCoreStack = new AgentCoreStack(app, 'AgentCoreStack', {
  prefix: config.prefix,
  inferenceProfileArn: bedrockStack.inferenceProfileArn,
  env,
});
agentCoreStack.addDependency(bedrockStack);

Object.entries(tags).forEach(([key, value]) => {
  cdk.Tags.of(bedrockStack).add(key, value as string);
  cdk.Tags.of(agentCoreStack).add(key, value as string);
});
