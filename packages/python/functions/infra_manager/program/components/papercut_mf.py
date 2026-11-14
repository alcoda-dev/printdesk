import json
from dataclasses import dataclass

import pulumi
import pulumi_aws as aws
import pulumi_cloudflare as cloudflare
from models import PapercutMfEnabledConfig
from utils import is_prod_stage, naming

from sst import Resource


@dataclass
class PapercutMfArgs:
    tenant_id: pulumi.Input[str]
    config: PapercutMfEnabledConfig


class PapercutMf(pulumi.ComponentResource):
    def __init__(
        self, args: PapercutMfArgs, opts: pulumi.ResourceOptions | None = None
    ):
        super().__init__(
            t="pd:awscf:PapercutMf", name="PapercutMf", props=vars(args), opts=opts
        )

        self._sync_schedule_role = aws.iam.Role(
            resource_name="PapercutMfSyncScheduleRole",
            args=aws.iam.RoleArgs(
                assume_role_policy=aws.iam.get_policy_document_output(
                    statements=[
                        aws.iam.GetPolicyDocumentStatementArgs(
                            principals=[
                                aws.iam.GetPolicyDocumentStatementPrincipalArgs(
                                    type="Service",
                                    identifiers=["scheduler.amazonaws.com"],
                                )
                            ]
                        )
                    ]
                ).json,
                inline_policies=[
                    aws.iam.get_policy_document_output(
                        statements=[
                            aws.iam.GetPolicyDocumentStatementArgs(
                                actions=["lambda:InvokeFunction"],
                                resources=[Resource.PapercutSync.arn],
                            )
                        ]
                    ).json
                ],
            ),
            opts=pulumi.ResourceOptions(parent=self),
        )

        self._sync_schedule = aws.scheduler.Schedule(
            resource_name="PapercutMfSyncSchedule",
            args=aws.scheduler.ScheduleArgs(
                flexible_time_window=aws.scheduler.ScheduleFlexibleTimeWindowArgs(
                    mode="OFF",
                ),
                schedule_expression=f"cron({args.config.sync.cron_expression})",
                schedule_expression_timezone=args.config.sync.timezone,
                target=aws.scheduler.ScheduleTargetArgs(
                    arn="arn:aws:scheduler:::aws-sdk:lambda:invoke",
                    role_arn=self._sync_schedule_role.arn,
                    input=pulumi.Output.json_dumps(
                        {
                            "FunctionName": Resource.PapercutMfSync.arn,
                            "InvocationType": "Event",
                        }
                    ),
                ),
            ),
            opts=pulumi.ResourceOptions(parent=self),
        )

        self._invoices_processor_dead_letter_queue = aws.sqs.Queue(
            resource_name="PapercutMfInvoicesProcessorDeadLetterQueue",
            args=aws.sqs.QueueArgs(
                fifo_queue=True,
                content_based_deduplication=True,
            ),
            opts=pulumi.ResourceOptions(
                parent=self,
                retain_on_delete=is_prod_stage,
            ),
        )

        self._invoices_processor_queue = aws.sqs.Queue(
            resource_name="PapercutMfInvoicesProcessorQueue",
            args=aws.sqs.QueueArgs(
                fifo_queue=True,
                content_based_deduplication=True,
                visibility_timeout_seconds=30,
                redrive_policy=pulumi.Output.json_dumps(
                    {
                        "deadLetterTargetArn": self._invoices_processor_dead_letter_queue.arn,
                        "maxReceiveCount": 3,
                    }
                ),
            ),
            opts=pulumi.ResourceOptions(
                parent=self,
                retain_on_delete=is_prod_stage,
            ),
        )

        self._invoices_processor_queue_policy = aws.sqs.QueuePolicy(
            resource_name="PapercutMfInvoicesProcessorQueuePolicy",
            args=aws.sqs.QueuePolicyArgs(
                queue_url=self._invoices_processor_queue.url,
                policy=aws.iam.get_policy_document_output(
                    statements=self._invoices_processor_queue.arn.apply(
                        lambda arn: [
                            aws.iam.GetPolicyDocumentStatementArgs(
                                principals=[
                                    aws.iam.GetPolicyDocumentStatementPrincipalArgs(
                                        type="AWS",
                                        identifiers=[
                                            Resource.InvoicesProcessor.roleArn
                                        ],
                                    )
                                ],
                                actions=[
                                    "sqs:ChangeMessageVisibility",
                                    "sqs:DeleteMessage",
                                    "sqs:GetQueueAttributes",
                                    "sqs:GetQueueUrl",
                                    "sqs:ReceiveMessage",
                                ],
                                resources=[arn],
                            )
                        ]
                    )
                ).json,
            ),
            opts=pulumi.ResourceOptions(parent=self),
        )

        self._invoices_processor_event_source_mapping = aws.lambda_.EventSourceMapping(
            resource_name="PapercutMfInvoicesProcessorEventSourceMapping",
            args=aws.lambda_.EventSourceMappingArgs(
                function_response_types=["ReportBatchItemFailures"],
                batch_size=10,
                maximum_batching_window_in_seconds=0,
                event_source_arn=self._invoices_processor_queue.arn,
                function_name=Resource.InvoicesProcessor.name,
            ),
            opts=pulumi.ResourceOptions(parent=self),
        )

        self._invoices_processor_queue_sender_role = aws.iam.Role(
            resource_name="PapercutMfInvoicesProcessorQueueSenderRole",
            args=aws.iam.RoleArgs(
                name=pulumi.Output.from_input(args.tenant_id).apply(
                    lambda tenant_id: naming.template(
                        name_template=Resource.InvoicesProcessorQueueSenderRoleTemplate.name,
                        tenant_id=tenant_id,
                    )
                ),
                assume_role_policy=aws.iam.get_policy_document_output(
                    statements=[
                        aws.iam.GetPolicyDocumentStatementArgs(
                            principals=[
                                aws.iam.GetPolicyDocumentStatementPrincipalArgs(
                                    type="AWS",
                                    identifiers=[Resource.Api.arn],
                                )
                            ],
                            actions=["sts:AssumeRole"],
                        )
                    ]
                ).json,
                inline_policies=[
                    aws.iam.get_policy_document_output(
                        statements=self._invoices_processor_queue.arn.apply(
                            lambda arn: [
                                aws.iam.GetPolicyDocumentStatementArgs(
                                    actions=["sqs:SendMessage", "sqs:SendMessageBatch"],
                                    resources=[arn],
                                )
                            ]
                        )
                    ).json
                ],
            ),
            opts=pulumi.ResourceOptions(parent=self),
        )

        self._api_tunnel = cloudflare.ZeroTrustTunnelCloudflared(
            resource_name="PapercutMfApiTunnel",
            args=cloudflare.ZeroTrustTunnelCloudflaredArgs(
                account_id=Resource.Cloudflare.account.id,
                config_src="cloudflare",
                name="",
            ),
            opts=pulumi.ResourceOptions(parent=self),
        )

        self._api_vpc_service = cloudflare.ConnectivityDirectoryService(
            resource_name="PapercutMfApiVpcService",
            args=cloudflare.ConnectivityDirectoryServiceArgs(
                account_id=Resource.Cloudflare.account.id,
                type="http",
                name="",
                host=cloudflare.ConnectivityDirectoryServiceHostArgs(
                    **(
                        {
                            "ipv4": args.config.api.host.ipv4,
                            "network": cloudflare.ConnectivityDirectoryServiceHostNetworkArgs(
                                tunnel_id=self._api_tunnel.id,
                            ),
                        }
                        if args.config.api.host._tag == "PapercutMfApiHostIpv4Config"
                        else {
                            "hostname": args.config.api.host.name,
                            **(
                                {
                                    "network": cloudflare.ConnectivityDirectoryServiceHostNetworkArgs(
                                        tunnel_id=self._api_tunnel.id,
                                    )
                                }
                                if args.config.api.host.resolver_ips is None
                                else {
                                    "resolver_network": cloudflare.ConnectivityDirectoryServiceHostResolverNetworkArgs(
                                        tunnel_id=self._api_tunnel.id,
                                        resolver_ips=args.config.api.host.resolver_ips,
                                    )
                                }
                            ),
                        }
                    )
                ),
                **(
                    {"https_port": args.config.api.port}
                    if args.config.api.protocol == "https"
                    else {"http_port": args.config.api.port}
                ),
            ),
            opts=pulumi.ResourceOptions(parent=self),
        )

        self._api_gateway_script = cloudflare.WorkersScript(
            resource_name="PapercutMfApiGatewayScript",
            args=cloudflare.WorkersScriptArgs(
                script_name="PapercutMfApiGatewayScript",
                account_id=Resource.Cloudflare.account.id,
                compatibility_date="2026-05-05",
                content=aws.s3.get_object_output(
                    bucket=Resource.PapercutMfApiGatewayScriptObject.bucket,
                    key=Resource.PapercutMfApiGatewayScriptObject.key,
                    download_body=True,
                ).body,
                bindings=[
                    cloudflare.WorkersScriptBindingArgs(
                        type="plain_text",
                        name="AWS_ACCESS_KEY_ID",
                        text=Resource.PapercutMfApiGatewayAwsAccessKey.id,
                    ),
                    cloudflare.WorkersScriptBindingArgs(
                        type="secret_text",
                        name="AWS_SECRET_ACCESS_KEY",
                        text=pulumi.Output.secret(
                            Resource.PapercutMfApiGatewayAwsAccessKey.secret
                        ),
                    ),
                    cloudflare.WorkersScriptBindingArgs(
                        type="plain_text",
                        name="HOSTNAME",
                        text=args.config.api.host.ipv4
                        if args.config.api.host._tag == "PapercutMfApiHostIpv4Config"
                        else args.config.api.host.name,
                    ),
                    cloudflare.WorkersScriptBindingArgs(
                        type="vpc_service",
                        name="PAPERCUT_MF_API",
                        service_id=self._api_vpc_service.id,
                    ),
                    cloudflare.WorkersScriptBindingArgs(
                        type="plain_text",
                        name="PORT",
                        text=args.config.api.port,
                    ),
                    cloudflare.WorkersScriptBindingArgs(
                        type="plain_text",
                        name="PROTOCOL",
                        text=args.config.api.protocol,
                    ),
                    cloudflare.WorkersScriptBindingArgs(
                        type="secret_text",
                        name="SST_RESOURCE_Aws",
                        text=pulumi.Output.secret(
                            json.dumps(
                                {
                                    "account": {"id": Resource.Aws.account.id},
                                    "region": Resource.Aws.region,
                                    "type": Resource.Aws.type,
                                }
                            )
                        ),
                    ),
                    cloudflare.WorkersScriptBindingArgs(
                        type="secret_text",
                        name="SST_RESOURCE_Hostnames",
                        text=pulumi.Output.secret(json.dumps(vars(Resource.Hostnames))),
                    ),
                    cloudflare.WorkersScriptBindingArgs(
                        type="secret_text",
                        name="SST_RESOURCE_Issuer",
                        text=pulumi.Output.secret(json.dumps(vars(Resource.Issuer))),
                    ),
                    cloudflare.WorkersScriptBindingArgs(
                        type="plain_text",
                        name="TENANT_ID",
                        text=args.tenant_id,
                    ),
                ],
            ),
            opts=pulumi.ResourceOptions(parent=self),
        )

        self._api_route = cloudflare.WorkersRoute(
            resource_name="PapercutMfApiRoute",
            args=cloudflare.WorkersRouteArgs(
                zone_id=Resource.Zone.id,
                pattern=pulumi.Output.format(
                    "{0}/{1}/papercut/mf",
                    Resource.Hostnames.api,
                    args.tenant_id,
                ),
                script=self._api_gateway_script.script_name,
            ),
            opts=pulumi.ResourceOptions(parent=self),
        )

    @property
    def api_tunnel_id(self):
        return self._api_tunnel.id
