import { hashStringToPrettyString, prefixName } from "~/sst/naming";

export type PhysicalNameArgs = {
  max: $util.Input<number>;
  suffix?: $util.Input<string>;
  transform?: $util.Input<(name: string) => $util.Input<string>>;
};

export class PhysicalName<TLogical extends string> extends $util.ComponentResource {
  public readonly logical: TLogical;
  public readonly result: $util.Output<string>;

  public constructor(
    name: TLogical,
    args: PhysicalNameArgs,
    opts?: $util.ComponentResourceOptions,
  ) {
    super("pd:resource:PhysicalName", name, {}, opts);

    this.logical = name;

    const { max, suffix = "", transform = (n) => n } = args;

    const main = $resolve({ max: $output(max), suffix: $output(suffix) }).apply(({ max, suffix }) =>
      prefixName(max - 9 - suffix.length, name),
    );

    const randomSuffix = new random.RandomBytes(
      `${name}PhysicalNameRandomSuffix`,
      { length: 8 },
      { parent: this },
    ).hex.apply((hex) => hashStringToPrettyString(hex, 8));

    this.result = $resolve({
      name: $interpolate`${main}-${randomSuffix}${suffix}`,
      transform: $output(transform),
    }).apply(({ name, transform }) => $output(transform(name)));
  }
}
