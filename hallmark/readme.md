Hallmark
--------

For this site, I built the UI and created a new module called Advent. Advent pulls in data from a Google sheet containing text, image, and game parameters. The component creates a scrollable layout of nodes in the style of an advent calendar. If a node's unlock time falls on or before the current date, it becomes interactable. Each node has a completed, locked, unlocked, and currently selected visual state--each state can have a unique appearance. When a user clicks on a node, it launches a separate game engine based on the game type set in the Google sheet.