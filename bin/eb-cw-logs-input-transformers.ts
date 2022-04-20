#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { EbCwLogsInputTransformersStack } from "../lib/eb-cw-logs-input-transformers-stack";

const app = new cdk.App();
new EbCwLogsInputTransformersStack(app, "EbCwLogsInputTransformersStack", {
  synthesizer: new cdk.DefaultStackSynthesizer({ qualifier: "cwforward" })
});
