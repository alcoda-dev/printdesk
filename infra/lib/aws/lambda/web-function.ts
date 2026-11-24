export type WebFunctionArgs = sst.aws.WebFunctionArgs;

export class WebFunction extends sst.aws.WebFunction {
  public constructor(name: string, args: WebFunctionArgs, opts?: $util.ComponentResourceOptions) {
    super(name, args, opts);
  }

  public override getSSTLink() {
    const link = super.getSSTLink();

    return {
      ...link,
      properties: {
        ...link.properties,
        roleArn: this.nodes.role.arn,
      },
    };
  }
}
