export type EventFunctionArgs = sst.aws.FunctionArgs;

export class EventFunction extends sst.aws.Function {
  public constructor(
    name: string,
    args: sst.aws.FunctionArgs,
    opts?: $util.ComponentResourceOptions,
  ) {
    args.architecture ??= "arm64";
    args.runtime ??= "nodejs24.x";

    super(name, args, opts);
  }

  public override getSSTLink() {
    const link = super.getSSTLink();

    return {
      ...link,
      properties: {
        ...link.properties,
        arn: this.arn,
        roleArn: this.nodes.role.arn,
      },
    };
  }
}
