import { PhysicalName } from "../../../physical-name";

import { VisibleError } from "~/sst/error";

// oxlint-disable-next-line typescript/no-non-null-assertion
const accountId = cloudflare.getAccountsOutput().results[0]!.id;

const webFunctionDevBridgeTokenPhysicalName = new PhysicalName("WebFunctionDevBridgeToken", {
  max: 64,
});

export const webFunctionDevBridgeToken = new cloudflare.ZeroTrustAccessServiceToken(
  webFunctionDevBridgeTokenPhysicalName.logical,
  { accountId, name: webFunctionDevBridgeTokenPhysicalName.result, enabled: $dev },
);

const webFunctionDevTunnelPhysicalName = new PhysicalName("WebFunctionDevTunnel", {
  max: 64,
});

const webFunctionDevTunnel = new cloudflare.ZeroTrustTunnelCloudflared(
  webFunctionDevTunnelPhysicalName.logical,
  { accountId, configSrc: "cloudflare", name: webFunctionDevTunnelPhysicalName.result },
);
const tunnelId = webFunctionDevTunnel.id;

export const webFunctionDevBridgeWorker = new sst.cloudflare.Worker(`WebFunctionDevBridgeWorker`, {
  handler: "packages/typescript/functions/dev-bridge/src/worker/index.ts",
  url: true,
  transform: {
    worker(args) {
      args.bindings = $resolve({ bindings: $output(args.bindings), tunnelId }).apply(
        ({ bindings = [], tunnelId }) =>
          bindings.concat({ type: "vpc_network", name: "DEV_BRIDGE_VPC", tunnelId }),
      );
    },
  },
});

const webFunctionDevBridgeApplicationPhysicalName = new PhysicalName(
  "WebFunctionDevBridgeApplication",
  { max: 64 },
);

new cloudflare.ZeroTrustAccessApplication(webFunctionDevBridgeApplicationPhysicalName.logical, {
  accountId,
  name: webFunctionDevBridgeApplicationPhysicalName.result,
  type: "self_hosted",
  destinations: [
    {
      type: "worker",
      workerId: $resolve({
        workers: cloudflare.getWorkersOutput(
          { accountId },
          { dependsOn: webFunctionDevBridgeWorker },
        ).results,
        scriptName: webFunctionDevBridgeWorker.nodes.worker.scriptName,
      }).apply(function ({ workers, scriptName }) {
        const worker = workers.find((worker) => worker.name === scriptName);
        if (!worker) throw new VisibleError(`Cloudflare worker "${scriptName}" not found.`);
        return worker.id;
      }),
    },
  ],
  policies: [
    {
      name: "Allow Web Function Dev Bridge Access",
      decision: "non_identity",
      includes: [{ serviceToken: { tokenId: webFunctionDevBridgeToken.id } }],
    },
  ],
  serviceAuth401Redirect: true,
});

if ($dev) {
  const webFunctionDevBridgeCloudflaredImage = new docker.RemoteImage(
    "WebFunctionDevBridgeCloudflaredImage",
    { name: "cloudflare/cloudflared:latest" },
  );

  new docker.Container("WebFunctionDevBridgeCloudflaredContainer", {
    image: webFunctionDevBridgeCloudflaredImage.imageId,
    command: [
      "tunnel",
      "--no-autoupdate",
      "run",
      "--token",
      $util.secret(
        cloudflare.getZeroTrustTunnelCloudflaredTokenOutput({
          accountId,
          tunnelId: webFunctionDevTunnel.id,
        }).token,
      ),
    ],
  });
}
