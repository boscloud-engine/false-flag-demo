# Why old CI sucks

### *A gate you wait on — not a tool you use.*

---

**🐢 Slow**
- Cold runners reinstall the world before a single test runs.
- Minutes of waiting on every push.

**⏰ Wrong side of the commit**
- It only runs *after* you push.
- You can't check your work until it's already out there.

**📦 A black box**
- When it breaks, you get a wall of logs.
- Copy them somewhere else and guess.

---

### And now it's the bottleneck

- Agents made **writing** code cheap.
- The new bottleneck is **checking** it.
- The old loop: **push → wait → paste logs → repeat.**

---

> Slow, on the wrong side of the commit, and a black box.
> **Depot CI flips all three.**
