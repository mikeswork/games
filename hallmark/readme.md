Hallmark 2020
-------------

I skinned this entire arcade and created a new module called Advent. Advent pulls in data from a Google sheet containing rows of text, image, and game data. The module creates a scrollable layout of advent nodes, enabled if their unlock times fall on or before the current date. Each node has a completed, locked, unlocked, and currently-selected state, which uses a separate image. In addition, they can be styled with SCSS. When a user clicks on a node, it launches a separate game engine based on the game-type set in the Google sheet.