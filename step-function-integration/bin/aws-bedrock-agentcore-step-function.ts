#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import * as fs from 'fs';
import * as path from 'path';
import { BedrockStack } from '../lib/bedrock-stack';
import { AgentCoreStack } from '../lib/agentcore-stack';
import { StepFunctionStack } from '../lib/step-function-stack';

const app = new cdk.App();

// Load configuration
const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../config/config.json'), 'utf-8')
);
const tags = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../config/tags.json'), 'utf-8')
);

const prefix = config.prefix;

// Create Bedrock Stack with Inference Profile
const bedrockStack = new BedrockStack(app, 'BedrockStack', {
  prefix: prefix,
  inferenceProfileId: config.inferenceProfile,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

// Create AgentCore Stack with Runtime
const agentCoreStack = new AgentCoreStack(app, 'AgentCoreStack', {
  prefix: prefix,
  inferenceProfileArn: bedrockStack.inferenceProfileArn,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
agentCoreStack.addDependency(bedrockStack);

// Create Step Function Stack
const stepFunctionStack = new StepFunctionStack(app, 'StepFunctionStack', {
  prefix: prefix,
  agentRuntime: agentCoreStack.agentCoreRuntime,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
stepFunctionStack.addDependency(agentCoreStack);

// Apply tags from config/tags.json to all stacks
Object.entries(tags).forEach(([key, value]) => {
  cdk.Tags.of(bedrockStack).add(key, value as string);
  cdk.Tags.of(agentCoreStack).add(key, value as string);
  cdk.Tags.of(stepFunctionStack).add(key, value as string);
});