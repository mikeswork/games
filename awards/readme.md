Awards 2020
-----------

Several different games for the Academy Awards and Golden Globes.

I worked on skinning the Ballot Picker and refactoring it since it was extremely outdated: it did not have the new, desired game mechanics and did not run in the new framework. It's a complex game that must pull in data from an exported Google sheet, allow the user to select their movie choice for each category, and store the choices in an AWS DynamoDB database. When the current date falls after the award show has finished airing, the user can move through all the categories, see their choice, and see the winner. If the winner matches their choice, they are rewarded a certain amount of points. At the end, the user can see all the winners and their score.