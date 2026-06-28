/**
 * stevie-virtual-agency — Cloudflare Worker (queue consumer)
 */
import {
  assertEnv,
  type BaseEnv,
  handleConsumerError,
  InvalidMessageError,
  PermanentError,
  RetryableError,
  validateMessage,
  type VirtualAgencyMessage,
} from "@stevie/shared";

type Env = BaseEnv;

export default {
  async queue(
    batch: MessageBatch<unknown>,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    assertEnv<Env>(env, [
      "WEBHOOK_SECRET",
      "BACKEND_BASE_URL",
      "ENVIRONMENT",
    ]);

    for (const msg of batch.messages) {
      try {
        let payload: VirtualAgencyMessage;
        try {
          payload = validateMessage<VirtualAgencyMessage>(
            msg.body,
            "virtual_agency.task"
          );
        } catch (err) {
          if (err instanceof InvalidMessageError) {
            throw new PermanentError(
              `invalid virtual_agency.task message: ${err.message}`,
              err
            );
          }
          throw err;
        }
        await runOne(payload, env);
        msg.ack();
      } catch (err) {
        handleConsumerError(msg, err);
      }
    }
  },
} satisfies ExportedHandler<Env>;

async function runOne(
  payload: VirtualAgencyMessage,
  env: Env
): Promise<void> {
  const url = `${env.BACKEND_BASE_URL}/api/internal/virtual-agency/task`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-webhook-secret": env.WEBHOOK_SECRET,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status >= 500 || response.status === 429) {
      throw new RetryableError(`backend failed: ${response.status}`);
    }
    throw new PermanentError(`backend failed permanently: ${response.status}`);
  }
}
