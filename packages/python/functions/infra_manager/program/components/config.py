from dataclasses import dataclass

import pulumi
import pulumi_aws as aws
from utils import naming

from sst import Resource


@dataclass
class ConfigArgs:
    tenant_id: pulumi.Input[str]


class Config:
    def __init__(self, args: ConfigArgs, opts: pulumi.ResourceOptions | None = None):
        super().__init__(
            t="pd:aws:Config",
            name="Config",
            props=vars(args),
            opts=opts,
        )

        self._invoices_processor_client_credentials_configuration_profile = aws.appconfig.ConfigurationProfile(
            resource_name="ConfigInvoicesProcessorClientCredentialsConfigurationProfile",
            args=aws.appconfig.ConfigurationProfileArgs(
                application_id=Resource.AppconfigApplication.id,
                type="AWS.Freeform",
                location_uri="hosted",
                name=pulumi.Output.from_input(args.tenant_id).apply(
                    lambda tenant_id: naming.template(
                        name_template=Resource.InvoicesProcessorClientCredentialsConfigurationProfileTemplate.name,
                        tenant_id=tenant_id,
                    )
                ),
            ),
            opts=pulumi.ResourceOptions(parent=self),
        )

        self._papercut_mf_api_auth_token_configuration_profile = aws.appconfig.ConfigurationProfile(
            resource_name="ConfigPapercutMfApiAuthTokenConfigurationProfile",
            args=aws.appconfig.ConfigurationProfileArgs(
                application_id=Resource.AppconfigApplication.id,
                type="AWS.Freeform",
                location_uri="hosted",
                name=pulumi.Output.from_input(args.tenant_id).apply(
                    lambda tenant_id: naming.template(
                        name_template=Resource.PapercutMfApiAuthTokenConfigurationProfileTemplate.name,
                        tenant_id=tenant_id,
                    )
                ),
            ),
            opts=pulumi.ResourceOptions(parent=self),
        )

        self._papercut_mf_sync_client_credentials_configuration_profile = aws.appconfig.ConfigurationProfile(
            resource_name="ConfigPapercutMfSyncClientCredentialsConfigurationProfile",
            args=aws.appconfig.ConfigurationProfileArgs(
                application_id=Resource.AppconfigApplication.id,
                type="AWS.Freeform",
                location_uri="hosted",
                name=pulumi.Output.from_input(args.tenant_id).apply(
                    lambda tenant_id: naming.template(
                        name_template=Resource.PapercutMfSyncClientCredentialsConfigurationProfileTemplate.name,
                        tenant_id=tenant_id,
                    )
                ),
            ),
            opts=pulumi.ResourceOptions(parent=self),
        )

        self._appconfig_role = aws.iam.Role(
            resource_name="ConfigAppconfigRole",
            args=aws.iam.RoleArgs(
                name=pulumi.Output.from_input(args.tenant_id).apply(
                    lambda tenant_id: naming.template(
                        name_template=Resource.AppconfigRoleTemplate.name,
                        tenant_id=tenant_id,
                    )
                ),
                assume_role_policy=aws.iam.get_policy_document_output(
                    statements=[
                        aws.iam.GetPolicyDocumentStatementArgs(
                            principals=[
                                aws.iam.GetPolicyDocumentStatementPrincipalArgs(
                                    type="AWS", identifiers=[Resource.Api.roleArn]
                                )
                            ],
                            actions=["sts:AssumeRole"],
                        )
                    ]
                ).json,
                inline_policies=[
                    aws.iam.RoleInlinePolicyArgs(
                        policy=aws.iam.get_policy_document_output(
                            statements=pulumi.Output.all(
                                invoices_processor_client_credentials_configuration_profile=self._invoices_processor_client_credentials_configuration_profile.arn,
                                papercut_mf_api_auth_token_configuration_profile=self._papercut_mf_api_auth_token_configuration_profile.arn,
                                papercut_mf_sync_client_credentials_configuration_profile=self._papercut_mf_sync_client_credentials_configuration_profile.arn,
                            ).apply(
                                lambda arns: [
                                    aws.iam.GetPolicyDocumentStatementArgs(
                                        actions=[
                                            "appconfig:CreateHostedConfigurationVersion"
                                        ],
                                        resources=[
                                            Resource.AppconfigApplication.arn,
                                            arns[
                                                "invoices_processor_client_credentials_configuration_profile"
                                            ],
                                            arns[
                                                "papercut_mf_api_auth_token_configuration_profile"
                                            ],
                                            arns[
                                                "papercut_mf_sync_client_credentials_configuration_profile"
                                            ],
                                        ],
                                    ),
                                    aws.iam.GetPolicyDocumentStatementArgs(
                                        actions=["appconfig:StartDeployment"],
                                        resources=[
                                            Resource.AppconfigAllAtOnceDeploymentStrategy.arn,
                                            Resource.AppconfigApplication.arn,
                                            Resource.AppconfigEnvironment.arn,
                                            Resource.AppconfigLinear20PercentEvery6MinutesDeploymentStrategy.arn,
                                            arns[
                                                "invoices_processor_client_credentials_configuration_profile"
                                            ],
                                            arns[
                                                "papercut_mf_api_auth_token_configuration_profile"
                                            ],
                                            arns[
                                                "papercut_mf_sync_client_credentials_configuration_profile"
                                            ],
                                        ],
                                    ),
                                    aws.iam.GetPolicyDocumentStatementArgs(
                                        actions=[
                                            "appconfig:StartConfigurationSession",
                                            "appconfig:GetLatestConfiguration",
                                        ],
                                        resources=[
                                            arns[
                                                "invoices_processor_client_credentials_configuration_profile"
                                            ],
                                            arns[
                                                "papercut_mf_api_auth_token_configuration_profile"
                                            ],
                                            arns[
                                                "papercut_mf_sync_client_credentials_configuration_profile"
                                            ],
                                        ],
                                    ),
                                ]
                            )
                        ).json
                    )
                ],
            ),
            opts=pulumi.ResourceOptions(parent=self),
        )
