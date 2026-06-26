# Agent From Numbers To State: First-Principles Arrowsmith Pass

Date: 2026-06-04
Method: Research Arrowsmith open discovery
Status: first-principles decomposition and hypothesis map

## Research Question

If an AI agent is built from an LLM, an LLM is a machine-learning model, machine learning is statistical learning, and statistics reduces to numbers, random variables, distributions, and inference, where does the agent-state problem first appear?

Short answer:

> The state problem is not born at one single layer. Raw numbers, weights, activations, prompts, memories, and tool traces all contain state. But the **agent-state failure** begins when a statistical model trained on past data is asked to act in a changing environment and its parametric state, prompt context, retrieved memories, or tool observations are mistaken for current, sufficient, authoritative world state.

In simpler terms: the base model has **parameter state**, not **operational state**. An agent needs operational state to act safely. The gap between those two is where pm-substrate lives.

## A/B/C Framing

- **A problem:** LLM agents act from a mixture of learned statistical priors, transient prompt state, retrieved memories, tool observations, and environment feedback, but none of these is automatically a current, authoritative model of the world.
- **B bridge concepts:** random variable, distribution, parameter state, hidden state, belief state, observation, state estimation, distribution shift, partial observability, non-parametric memory, provenance, source authority, freshness, workflow state, common operating picture.
- **C literatures:** statistical learning, transformer language modeling, reinforcement learning, POMDPs, Bayesian filtering/Kalman filtering, RAG, LLM agent architectures, agent memory benchmarks, multi-agent failure taxonomies, distributed systems, control theory, and operational interoperability standards.

## Source Map

1. **Statistical learning**
   - Hastie, Tibshirani, and Friedman, *The Elements of Statistical Learning*.
   - Source: https://web.stanford.edu/~hastie/Papers/ESLII.pdf
   - Why it matters: machine learning is framed as data mining, inference, and prediction over statistical structure.

2. **Transformer architecture**
   - Vaswani et al., "Attention Is All You Need" (2017).
   - Source: https://arxiv.org/abs/1706.03762
   - Why it matters: the transformer makes token-to-token dependency computation the core architecture for modern LLMs.

3. **Large autoregressive language models**
   - Brown et al., "Language Models are Few-Shot Learners" (2020).
   - Source: https://arxiv.org/abs/2005.14165
   - Why it matters: GPT-style LLMs are autoregressive models used through text interaction without gradient updates at inference time.

4. **Agent-environment decision framing**
   - Sutton and Barto, *Reinforcement Learning: An Introduction*.
   - Source: http://incompleteideas.net/book/RLbook2020.pdf
   - Why it matters: the agent-environment loop makes state, action, reward, and observation explicit.

5. **Partial observability**
   - Kaelbling, Littman, and Cassandra, "Planning and acting in partially observable stochastic domains" (1998).
   - Source: https://www.sciencedirect.com/science/article/pii/S000437029800023X
   - Why it matters: an actor must choose actions when true environment state is not directly observed.

6. **State estimation**
   - Kalman, "A New Approach to Linear Filtering and Prediction Problems" (1960).
   - Source: https://www.cs.unc.edu/~welch/kalman/media/pdf/Kalman1960.pdf
   - Why it matters: mature engineering disciplines separate noisy observations from estimated hidden state.

7. **Parametric vs non-parametric memory**
   - Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks" (2020).
   - Source: https://arxiv.org/abs/2005.11401
   - Why it matters: parametric model memory struggles to update world knowledge and provide provenance; retrieval adds an external memory surface.

8. **LLM agents as reasoning/action loops**
   - Yao et al., "ReAct: Synergizing Reasoning and Acting in Language Models" (2023).
   - Source: https://arxiv.org/abs/2210.03629
   - Why it matters: agents interleave reasoning traces, actions, and observations from tools/environments.

9. **LLM agent memory architecture**
   - Park et al., "Generative Agents: Interactive Simulacra of Human Behavior" (2023).
   - Source: https://arxiv.org/abs/2304.03442
   - Why it matters: observation, planning, and reflection are distinct components, not one blob of "context."

10. **Belief-state discipline for LLM agents**
    - Kim et al., "QuBE: Question-based Belief Enhancement for Agentic LLM Reasoning" (EMNLP 2024).
    - Source: https://aclanthology.org/2024.emnlp-main.1193/
    - Why it matters: agentic LLMs can derail when they indiscriminately incorporate observations from partially observable environments; QuBE constructs a belief state by question answering.

11. **Agent memory evaluation**
    - Hu, Wang, and McAuley, "Evaluating Memory in LLM Agents via Incremental Multi-Turn Interactions" (arXiv 2025, revised 2026).
    - Source: https://arxiv.org/abs/2507.05257
    - Why it matters: memory agents need accurate retrieval, test-time learning, long-range understanding, and selective forgetting.

12. **Stale memory**
    - "STALE: Can LLM Agents Know When Their Memories Are No Longer Valid?" (2026).
    - Source: https://arxiv.org/abs/2605.06527
    - Why it matters: later observations can invalidate earlier memories without explicit negation.

13. **Multi-agent failure**
    - Cemri et al., "Why Do Multi-Agent LLM Systems Fail?" (2025).
    - Source: https://arxiv.org/abs/2503.13657
    - Why it matters: many failures cluster around system design, inter-agent misalignment, and task verification rather than only model intelligence.

## Ground-Up Decomposition: What An Agent Is Made Of

The cleanest first-principles stack is:

1. Numbers
2. Random variables and distributions
3. Statistical learning
4. Neural network parameter state
5. Transformer language model
6. Inference-time context and activations
7. Tool/retrieval/memory wrapper
8. Agent loop
9. Multi-agent or workspace environment
10. Governed operational state substrate

### Layer 0 - Numbers

At the bottom, the system is bits, integers, floating-point values, tensors, and matrix operations. A token ID is a number. An embedding is a vector of numbers. A model weight is a number. A probability distribution over next tokens is a vector of numbers.

**State at this layer:** memory addresses, tensor values, numeric precision, random seeds, optimizer slots, GPU cache, and serialized weights.

**Does the agent-state problem begin here?** Not in the product sense. Numeric state can corrupt, drift through precision issues, or become non-deterministic, but that is not yet "agent acts on stale world state." It is computational state, not semantic state.

**Failure class if it breaks:** reproducibility failure, numerical instability, nondeterministic replay.

**Substrate implication:** not a pm-substrate layer, except for reproducible evals: record model ID, seed when relevant, decoding settings, tool inputs, and event outputs.

### Layer 1 - Random Variables And Distributions

Statistics begins when numbers represent uncertain quantities. A variable X may take values. A model estimates P(Y | X), or a distribution over outcomes given observations.

At this layer, the primitive is not truth. The primitive is **uncertain inference**.

**State at this layer:** distributional assumptions, sufficient statistics, priors, likelihoods, posterior estimates.

**Does the agent-state problem begin here?** This is the conceptual seed. Once you say "I estimate a hidden thing from observations," you have separated observation from state. But there is still no agent until an action depends on that estimate.

**Failure class if it breaks:** uncertainty collapse, overconfidence, wrong prior, distribution shift.

**Substrate implication:** agent-facing state should never be framed as "the model knows." It should be framed as "this actor has this observation/evidence under this authority and freshness horizon."

### Layer 2 - Statistical Learning

A machine-learning model estimates a function from data:

```text
theta* = argmin_theta E_(x,y in D)[loss(f_theta(x), y)]
```

For a language model, the function eventually becomes a token predictor:

```text
p_theta(token_t | token_1 ... token_(t-1))
```

**State at this layer:** learned parameters theta, training distribution D, objective/loss, regularization, optimizer state during training.

**Key distinction:** model weights are **compressed historical evidence**. They are not a live world model. They encode patterns from the training distribution and fine-tuning/RLHF process.

**Does the agent-state problem begin here?** The first serious fault line appears here:

> The statistical model contains parametric state from the past, but an agent acts in the present.

If the world changes after training, the learned parameters do not update unless retraining/fine-tuning happens. So the model's parametric state is stale by construction relative to live operational state.

**Failure class if it breaks:** stale prior, hallucinated current fact, training-distribution bias, out-of-distribution action.

**Substrate implication:** weights can supply priors and language competence, but not authority. Current operational state must come from observed, timestamped, provenance-backed sources.

### Layer 3 - Neural Network Parameter State

The neural net is a giant parameterized function. During training, weights change. During ordinary inference, weights are fixed.

**State at this layer:**

- persistent: weights, tokenizer, architecture, adapter/LoRA weights, safety policy weights;
- transient: activations, attention scores, KV cache;
- stochastic: sampling path, temperature, top-p/top-k choices.

**Does the agent-state problem begin here?** A second fault line appears:

> The model has no native boundary between "what is true now," "what was common in training," "what the prompt says," and "what it inferred."

All of those get folded into token probabilities unless the system supplies external structure.

**Failure class if it breaks:** source confusion, prompt contamination, ungrounded inference, hidden assumption treated as fact.

**Substrate implication:** source authority cannot be left inside hidden activations. It has to be externalized as metadata and gates.

### Layer 4 - Transformer Language Model

A transformer converts token IDs into embeddings, applies attention blocks, and emits logits over next tokens. The model is powerful because attention lets every token condition on other tokens in the context window.

**State at this layer:**

- prompt tokens;
- position encodings;
- attention/KV cache;
- logits and sampling distribution;
- generated tokens so far.

**Does the agent-state problem begin here?** The third fault line appears:

> The LLM's "working state" is a context window, not an operational database.

The context window is finite, serial, lossy under summarization, sensitive to order, and not naturally authoritative. It can carry observations, but it does not know which observations supersede others unless the architecture tells it.

**Failure class if it breaks:** context rot, representation loss, stale observation, hidden conflict.

**Substrate implication:** context should be generated from substrate state, not become the state. A prompt is a read view.

### Layer 5 - Inference-Time Call

At inference, a caller gives the model messages and possibly tool schemas. The model emits text or tool calls. The model may not update weights; it only conditions on input and transient cache.

A simplified inference call:

```text
input_context = messages + retrieved_docs + tool_specs + current_goal
next_output ~ p_theta(output | input_context)
```

**State at this layer:** request payload, prompt, tool specs, model choice, decoding settings, hidden activations, output tokens.

**Does the agent-state problem begin here?** Yes, now it becomes operational:

> If the inference context is missing, stale, contradictory, or unauthoritative, the model can reason well and still choose the wrong action.

This is the simplest version of the agent-state problem.

**Failure class if it breaks:** partial observation, stale observation, source authority conflict, representation loss.

**Substrate implication:** an LLM call should be treated like a state read plus a proposed action. The read set must be recorded. The action should be validated against current state before mutation.

### Layer 6 - Retrieval And Memory

RAG and memory systems add external records. This helps because facts can be updated without retraining the model. But retrieval is not truth either. It is another observation channel.

**State at this layer:** vector index, documents, memory rows, summaries, scores, timestamps, source IDs, retrieval query, reranker output.

**Does the agent-state problem begin here?** It becomes worse if memory is not governed:

> Retrieved memory can be stale, semantically similar but wrong, missing source authority, or a summary that lost the exact constraint needed for safe action.

Memory is helpful only if it has lifecycle: write policy, supersession, contradiction detection, freshness, and provenance.

**Failure class if it breaks:** memory drift, stale observation, representation loss, source authority conflict.

**Substrate implication:** agent memory must be derivative of graph/events/workflow evidence. A memory without provenance is a note, not authority.

### Layer 7 - Tool Use

Tools let the model affect or observe the external world: search, filesystem, database, CRM, calendar, payments, code execution, email, trading simulation, etc.

**State at this layer:** tool schemas, permissions, tool inputs, tool outputs, side effects, return codes, external source timestamps.

**Does the agent-state problem begin here?** This is where it becomes high consequence:

> Once the agent can mutate the world, stale or wrong state is no longer just a bad answer. It becomes a bad side effect.

**Failure class if it breaks:** capability contract violation, unauthorized action, workflow invalidation, parallel write conflict.

**Substrate implication:** every mutation path needs deterministic gates: schema validation, permission, tenant, source authority, workflow position, and read-set freshness.

### Layer 8 - Agent Loop

A minimal agent from scratch is not just an LLM. It is a loop:

```text
goal = user_or_workflow_goal
belief = initial_state_view(goal)

while not done:
    observation = observe(environment, tools, substrate)
    belief = update_belief(belief, observation)
    proposal = llm(policy_prompt(goal, belief, allowed_tools))
    action = parse_or_select_action(proposal)
    decision = validate(action, belief, current_substrate_state)
    if decision.allowed:
        result = execute(action)
        record_event(action, result, read_set, provenance)
    else:
        record_block(action, decision.reason)
        replan()
```

**State at this layer:** goal, task plan, belief/current-state view, scratchpad, tool history, pending actions, completed actions, failure traces.

**Does the agent-state problem begin here?** This is the named "agent state problem":

> The agent needs a belief state. Most LLM agents substitute accumulated text for belief state.

That substitution works in demos and fails under change.

**Failure class if it breaks:** workflow invalidation, memory drift, feedback disconnection, continuity break.

**Substrate implication:** pm-substrate should supply the belief-state ingredients: current graph/projection state, event provenance, freshness, authority rules, workflow position, and admissible next actions.

### Layer 9 - Multi-Agent / Workspace Environment

When multiple agents, people, and tools act, each actor has a partial local view. The state problem becomes coordination:

- Who saw what?
- Which source is binding?
- Which fact is stale?
- Which workflow position is current?
- Which action is valid now?
- Which actor/tool caused the failure?
- Which representation lost meaning?

**State at this layer:** shared environment state, private actor state, source systems, event order, workflow state, locks/gates, conflict records.

**Does the agent-state problem begin here?** This is where the problem becomes a substrate problem:

> State failure is no longer inside one model. It is between actors.

**Failure class if it breaks:** source authority conflict, parallel write conflict, task verification failure, inter-agent misalignment.

**Substrate implication:** chat and protocols are not enough. Actors need a shared operational world model with provenance and gates.

## Where The State Problem Is Initialized

There are three different meanings of "state," and the answer depends on which one we mean.

| State type | Where it lives | What it means | Why it is insufficient |
| --- | --- | --- | --- |
| Parameter state | model weights theta | statistical compression of training/fine-tuning data | stale relative to current world; no source authority |
| Inference state | prompt, activations, KV cache, generated tokens | temporary working context for one call/run | finite, lossy, order-sensitive, not durable |
| Memory state | RAG docs, vector DB, summaries, agent memory | external facts or experiences retrieved into context | can be stale, ungoverned, conflicting, unauthoritative |
| Operational state | source systems, events, graph, workflows, projections | current admissible world model for action | only exists if built and governed |

The **first mathematical seed** is uncertainty: a model estimates from data.

The **first ML fault line** is stale parametric state: weights encode a past distribution, not the current world.

The **first agent fault line** is partial observability: the agent must act from observations that may not reveal true state.

The **first product fault line** is authority: the agent can observe many things, but it must know which source is binding for the action.

The strongest conclusion:

> The state problem is initialized when a statistical predictor is promoted into an actor without giving it a governed belief/current-state layer between prediction and action.

## Arrowsmith Matrix

| A problem in LLM agents | B bridge concept | C domain/source | Evidence strength | Hypothesis for pm-substrate | Implementation implication | Metric | Falsifier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Model weights contain old statistical regularities, not current truth | Parametric state vs operational state | Statistical learning, GPT-3, RAG | High | Treat model output as prior/proposal, not authority. | Every high-consequence answer/action cites current source refs. | `evidence_coverage` | Model-only baseline matches substrate under changed-source scenarios. |
| Prompt context is treated as state | Inference state vs durable state | Transformer/LLM inference | High | Prompt is a read view generated from state, not the state system. | Record read set, prompt-generation source refs, and snapshot time. | `stale_action_rate` | Prompt-only agent does not degrade under long/change-heavy tasks. |
| Agent sees observations but not true environment | Partial observability and belief state | POMDP, QuBE | High | Agent reliability needs belief-state discipline. | Build agent-facing `current_state_view` with observedAt, authority, uncertainty/freshness, and missing-source flags. | `partial_observation_rate` | Belief-state metadata does not reduce invalid actions. |
| Retrieved memories are stale or conflicting | Memory lifecycle and selective forgetting | MemoryAgentBench, STALE | High | Memory must support supersession, contradiction, and invalidation. | Continuity checkpoints should include evidence refs, supersedes refs, validUntil, contradiction status. | `contradiction_rate`, `resume_success_rate` | Flat vector retrieval equals substrate on stale-memory tests. |
| Tool outputs lose provenance | Provenance and non-parametric memory | RAG, W3C PROV, event sourcing | High | Tool outputs become admissible only when source, time, actor, and derivation are preserved. | Tool observations become typed events/source records before being summarized into memory. | `replay_fidelity` | Event/provenance logging cannot reconstruct why an action occurred. |
| Tool call mutates world from stale read | Read-set freshness | Databases, workflow gates, control loops | High | A mutation must prove its read state is still current enough. | Capability invocation stores read-set refs and rejects if authority/freshness changed. | `stale_action_rate`, `workflow_invalid_transition_rate` | Revalidation adds cost but does not reduce bad mutations. |
| Multiple agents coordinate through chat | Shared blackboard / common operating picture | Blackboard MAS, MAST, COP practice | Medium-high | Multi-agent systems need shared governed state, not only messages. | Agents coordinate via graph/events/workflows; chat is a UI, not source of truth. | `state_disagreement_rate` | Chat-only agents match substrate on conflicting-source workflows. |
| Business tool data maps into agent memory as text | Semantic contracts | FHIR/OPC/EPCIS/data contracts, pm-substrate profiles | High | Adapter mapping must preserve semantics before AI can act. | Source schema -> mapping -> deterministic validation -> typed events -> projection. | `representation_loss_rate`, `mapping_rejection_rate` | Validated mapping still loses decision-critical meaning. |

## The Simplest Problem Statement

An agent is not just a model. It is:

```text
agent = model + goal + observation channel + memory + tools + policy + state update loop
```

The model computes:

```text
p_theta(next_token | context)
```

The agent needs:

```text
valid_next_action = f(current_world_state, goal, permissions, workflow, source_authority)
```

Those are different functions.

The substrate exists because modern LLM agents are often asked to solve the second problem using only machinery built for the first.

## What This Means For pm-substrate

The substrate should be framed as the layer that converts observations into admissible operational state:

1. **Observation:** something was read, received, or emitted.
2. **Provenance:** who/what produced it, when, under which authority.
3. **Semantic contract:** what entity/event/workflow meaning it has.
4. **State estimate/projection:** what current state follows from those observations.
5. **Authority gate:** whether this state is binding for this decision.
6. **Action validation:** whether the proposed mutation is valid now.
7. **Feedback/rebase:** whether later events invalidate, correct, or supersede prior state.

That is the bridge from numbers to work:

```text
numbers -> probability -> prediction -> language -> tool proposal -> validated action
```

Without the substrate, the system often jumps directly from:

```text
probability -> text -> action
```

That shortcut is the state problem.

## New Hypotheses To Test

### Hypothesis 1 - The earliest measurable failure is distribution-currentness mismatch

**Claim:** A base model's parametric state is stale relative to live business state. RAG helps, but only if retrieved records carry freshness and authority.

**Experiment:** Create a scenario where training-prior/common-knowledge answer conflicts with current source-backed state. Compare model-only, RAG-only, and substrate-read arms.

**Metric:** `source_authority_violation_rate`, `stale_action_rate`.

**Falsifier:** RAG-only with no authority metadata matches substrate-read performance.

### Hypothesis 2 - Prompt context is not belief state

**Claim:** A prompt that contains observations but lacks structured freshness/authority produces more invalid actions than a belief-state view.

**Experiment:** Give agents the same facts as plain text vs. structured `current_state_view` with source refs, observedAt, validUntil, and authority rule.

**Metric:** `workflow_invalid_transition_rate`, `state_disagreement_rate`.

**Falsifier:** Plain-text context performs as well under stale/conflicting observations.

### Hypothesis 3 - Memory must be a derived view, not a second state system

**Claim:** Agent memory should be generated from graph/events/workflow evidence, not maintained as independent truth.

**Experiment:** Let an agent resume after a source record changes. Compare flat summary memory, vector memory, and substrate continuity with contradiction checks.

**Metric:** `resume_success_rate`, `contradiction_rate`.

**Falsifier:** Flat memory resumes as accurately as evidence-linked continuity.

### Hypothesis 4 - Tool mutation requires read-set validation

**Claim:** High-consequence tool calls need pre-mutation validation against current read-set state.

**Experiment:** Agent reads risk state, then risk changes before action. Compare action allowed by agent-only tool call vs. substrate capability gate.

**Metric:** `stale_action_rate`, `capability_contract_violation_rate`.

**Falsifier:** Read-set validation blocks no additional bad actions.

### Hypothesis 5 - Common operating picture is the product surface of belief state

**Claim:** A COP is not a dashboard; it is the shared belief/current-state surface that lets many actors coordinate under partial observability.

**Experiment:** Two agents/teams start from conflicting local truth. Compare chat-only reconciliation vs. COP showing current source authority, event proof, owner, blockers, and valid next actions.

**Metric:** `mean_time_to_reconcile`, `state_disagreement_rate`.

**Falsifier:** COP does not reduce disagreement or reconciliation time.

## Rejected Or Weak Bridges

1. **"The model weights are the agent's memory."**
   - Weak because weights are not source-addressable, easily updated, tenant-scoped, or authority-aware.

2. **"RAG solves state."**
   - RAG helps update and ground language generation, but retrieval is not governance. It does not by itself decide source authority, workflow validity, or stale-read rejection.

3. **"A bigger context window solves state."**
   - Larger context increases capacity but not necessarily relevance, freshness, authority, or contradiction handling.

4. **"Multi-agent chat solves coordination."**
   - Chat passes messages. It does not provide a shared operational world model unless messages are converted into durable, typed, provenance-backed state.

5. **"The agent's hidden chain of thought is belief state."**
   - Hidden reasoning is not inspectable, replayable, source-linked, or enforceable. Belief state for operations must be external enough to validate and audit.

## Product/Implementation Recommendations

1. Build a formal `current_state_view` contract for agent reads.
   - Minimum fields: `sourceRefs`, `observedAt`, `validUntil`, `authorityRule`, `projectionVersion`, `workflowPosition`, `missingSources`, `conflicts`.

2. Treat every LLM action as a proposal, not a mutation.
   - Mutation requires schema validation, permission, tenant, authority, and read-set freshness.

3. Make memory writebacks explicit.
   - A memory write should say whether it is an observation, summary, preference, rule, decision, or derived projection, and which evidence it comes from.

4. Add an eval class or metric for **distribution-currentness mismatch**.
   - This is the first-principles bridge from statistical learning to stale operational state.

5. Continue the ArrowHedge pattern.
   - Source records -> profile mapping -> typed events -> graph/projection -> COP -> eval metrics is the correct first real-ish tool surface because it exercises the whole stack.

6. Name the state layers in the thesis.
   - Suggested language: "LLM weights are parametric state; prompts are inference state; memories are retrieval state; pm-substrate supplies operational state."

## Working Conclusion

From first principles, the agent is made of numbers, but numbers become agents through layers of interpretation:

```text
numbers -> random variables -> learned parameters -> token distributions -> language outputs -> tool proposals -> world mutations
```

The state problem appears when the system crosses from **prediction** into **action** without a governed representation of what is currently true.

So the deepest thesis is:

> pm-substrate is not a bigger memory for agents. It is the missing state-estimation and authority layer between statistical prediction and operational action.

