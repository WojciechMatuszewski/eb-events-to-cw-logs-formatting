# Forwarding EB events to CW Logs + escaping

An example of how one might push EB events into a given CW log group using the InputTransformer.
Since the formatting is quite tricky to get right, I decided to publish this example.

Enjoy!

## Learnings

- As soon as I use the Input Transformer, the delivery to the CW Logs fails with an "Unknown exception" (one of the attributes of the messages that fall into DLQ).

  - ~~I suspect this is related to serialization (or double serialization) between CW Logs and EB Input Transformer.~~

  - This is related to the [`PutLogEvents`](https://docs.aws.amazon.com/AmazonCloudWatchLogs/latest/APIReference/API_PutLogEvents.html) API expecting the payload to have `timestamp` and `message` properties. It looks to me that if I do not specify the InputTransformer, the shape of the `PutLogEvents` API is honored. If I do, the EB will not add the `timestamp` property for me.

- I was able to forward the whole event manually by escaping each field separately.

  ```ts
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
            \"detail-type\": ${aws_events.EventField.fromPath("$.detail-type")},
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
  ```

- I had to provide a valid resource policy for DLQ for the EB rule to push messages there. Otherwise, the EB rule would silently fail while delivering to DLQ.

  - Maybe I misconfigured something in the first place?
