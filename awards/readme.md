Awards 2020
-----------

I worked on the UI and functionality of a module called Ballot Picker. The outdated state of this component required me to completely refactor it--the client wanted new game mechanics and a recent upgrade to our framework caused it to not run at all.

The Ballot Picker is a complex experience that pulls in movie and award data from a JSON file, allows the user to select their choice for each category, and stores these choices in an AWS DynamoDB database. After the award show has finished airing, the module automatically unlocks all the categories so that users can browse through them, see the choice they made for each, and compare the actual award winner with the option they selected. For any of their choices that match the winners, users are rewarded a certain amount of points. In the final screen, users can see their overall score and all the category winners.