import assert from "node:assert/strict";
import test from "node:test";

import { selectDeviceAddress } from "./device-config.mjs";

test("selects the active physical interface", () => {
  const interfaces = {
    en0: [{ address: "192.168.110.48", family: "IPv4", internal: false }],
    en5: [{ address: "10.0.0.20", family: "IPv4", internal: false }],
  };

  assert.equal(selectDeviceAddress(interfaces, "en5"), "10.0.0.20");
});

test("ignores virtual, loopback, and public addresses", () => {
  const interfaces = {
    lo0: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
    utun4: [{ address: "10.8.0.2", family: "IPv4", internal: false }],
    bridge100: [{ address: "192.168.64.1", family: "IPv4", internal: false }],
    en0: [
      { address: "8.8.8.8", family: "IPv4", internal: false },
      { address: "192.168.1.25", family: "IPv4", internal: false },
    ],
  };

  assert.equal(selectDeviceAddress(interfaces, "utun4"), "192.168.1.25");
});

test("returns null when no phone-reachable LAN address exists", () => {
  const interfaces = {
    lo0: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
    en0: [{ address: "203.0.113.10", family: "IPv4", internal: false }],
  };

  assert.equal(selectDeviceAddress(interfaces, "en0"), null);
});
