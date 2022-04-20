import {
  aws_events,
  aws_events_targets,
  aws_iam,
  aws_logs,
  aws_sqs,
  RemovalPolicy,
  Stack,
  StackProps
} from "aws-cdk-lib";
import { Construct } from "constructs";

export class EbCwLogsInputTransformersStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const bus = new aws_events.EventBus(this, "bus");

    const targetLogGroup = new aws_logs.LogGroup(this, "targetLogGroup", {
      logGroupName: "/aws/events/target",
      removalPolicy: RemovalPolicy.DESTROY
    });
    const dql = new aws_sqs.Queue(this, "dql", {
      removalPolicy: RemovalPolicy.DESTROY
    });

    const rule = new aws_events.Rule(this, "rule", {
      eventBus: bus,
      targets: [
        new aws_events_targets.CloudWatchLogGroup(targetLogGroup, {
          deadLetterQueue: dql,
          event: aws_events.RuleTargetInput.fromObject({
            timestamp: aws_events.EventField.time,
            /**
             * message: "<aws.events.event.json>" does not work -> Invalid input for target.
             * message: "<aws.events.event>" does not work -> Invalid input for target.
             * message: "some log" is working and I see the "some log" in the log stream.
             *
             * I have to find a way to escape the whole event somehow
             *
             * message: {"version": aws_events.EventField.fromPath("$.version")} pushes an empty `{\n}` into the log stream.
             *
             * I managed to get the formatting working by manually escaping the message.
             * message: `{\"version\": ${aws_events.EventField.fromPath("$.version")}}`
             */
            message: `{
              \"version\": ${aws_events.EventField.fromPath("$.version")},
              \"id\": ${aws_events.EventField.fromPath("$.id")},
              \"detail-type\": ${aws_events.EventField.fromPath(
                "$.detail-type"
              )},
              \"source\": ${aws_events.EventField.fromPath("$.source")},
              \"account\": ${aws_events.EventField.fromPath("$.account")},
              \"time\": ${aws_events.EventField.fromPath("$.time")},
              \"region\": ${aws_events.EventField.fromPath("$.region")},
              \"resources\": ${aws_events.EventField.fromPath("$.resources")},
              \"detail\": ${aws_events.EventField.fromPath("$.detail")},
            }`
            /**
             * You can add more fields. Remember about escaping!
             */
          }),
          retryAttempts: 0
        })
      ],
      eventPattern: {
        detailType: ["ebtest"],
        source: ["ebtest"],
        version: ["0"]
      }
    });

    dql.addToResourcePolicy(
      new aws_iam.PolicyStatement({
        principals: [new aws_iam.ServicePrincipal("events.amazonaws.com")],
        actions: ["sqs:SendMessage"],
        effect: aws_iam.Effect.ALLOW,
        resources: [dql.queueArn],
        conditions: {
          ArnEquals: {
            "aws:SourceArn": rule.ruleArn
          }
        }
      })
    );
  }
}
