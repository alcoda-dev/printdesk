ARG PYTHON_VERSION=3.14
ARG PULUMI_VERSION=3.272.0

FROM public.ecr.aws/lambda/python:${PYTHON_VERSION}

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Install system dependencies
RUN dnf install -y git gcc python3-devel tar gzip && dnf clean all

# Install pulumi
RUN curl -fsSL https://get.pulumi.com | sh -s -- --version ${PULUMI_VERSION}
RUN mv /root/.pulumi /opt/pulumi
ENV PATH="/opt/pulumi/bin:${PATH}"
RUN mkdir /tmp/pulumi_home
ENV PULUMI_HOME=/tmp/pulumi_home

# Copy function source code
COPY . ${LAMBDA_TASK_ROOT}

# Install python dependencies
RUN uv pip install -r requirements.txt --target ${LAMBDA_TASK_ROOT} --system

# No need to configure the handler or entrypoint - SST will do that
