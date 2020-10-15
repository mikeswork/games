Hub
---

This was an ambitious project to create an experience that users would want to play in and return to. We achieved the goal by developing a customizable site that an administrator could keep fresh by changing skins (e.g. for different holidays, sporting events, etc.), adding rewards, featuring contests, and featuring different games. Each user automatically gets a basic, default account that keeps track of their points. They earn points by visiting certain areas, completing games, or achieving minimum scores. Once they decide to register their account, they can receive different rewards as their skill lever increases. Rewards allow users to customize their home screen with various, fun items (some animated via gifs or a sprite player). 

Since we had to support limited hardware, none of the existing Node or JavaScript sprite player solutions worked for us. So, I built a lightweight, reusable player that allowed us to do custom animations (with settings such as loop/play once, speed, delay, delay between play-throughs, etc.) 

In preparation for a major release, I investigated the best approach for adding more rooms/sections to the experience and discovered the most intuitive technique for a visual transition between the spaces (e.g. css animation vs. video).
