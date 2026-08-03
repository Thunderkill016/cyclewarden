import { FakeCodingAgentProvider } from "./fake-agent-provider.js";
import { FakeSandboxProvider } from "./fake-sandbox-provider.js";
import { FakeSourceProvider } from "./fake-source-provider.js";
import { defineCodingAgentProviderContract } from "./provider-contracts/coding-agent-provider-contract.js";
import { defineSandboxProviderContract } from "./provider-contracts/sandbox-provider-contract.js";
import { defineSourceProviderContract } from "./provider-contracts/source-provider-contract.js";

defineSourceProviderContract("fake", () => new FakeSourceProvider());
defineCodingAgentProviderContract("fake", () => new FakeCodingAgentProvider());
defineSandboxProviderContract("fake", () => new FakeSandboxProvider());
