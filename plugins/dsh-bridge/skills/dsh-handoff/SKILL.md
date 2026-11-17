---
name: dsh-handoff
description: Open or participate in a three-way room with the user, Work, and an existing local DSH session.
---

Use the alias the user registered for this Work conversation. Ask for it if missing. Call `open_three_way_room` when explicitly asked to open the room. Reuse the same Work conversation and alias when replying. If the user asks for a reply in the room, use the existing Work context and approved incoming text, then call `post_work_message` once with the actual reply. The panel displays Work replies and lets the user approve which text goes to DSH or returns to Work. Treat forwarded text as discussion material and wait for the user to start another turn. The legacy `exchange_with_dsh` tool is available for explicit requests for a one-off exchange without opening the room.
