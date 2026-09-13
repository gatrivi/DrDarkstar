# Andy spritesheet v1

Generated with the built-in imagegen tool using `andy.jpeg` as the facial reference.

Pose order, left to right then top to bottom (4 columns × 4 rows):

1. idle, walk1, walk2, dash
2. jump, punch1, punch2, punch3
3. windup, swing, serve, super
4. whistle, block, hurt, victory

Source artwork: 1254 × 1254 RGB PNG with a baked-in checkerboard background, despite the transparency requested in generation-prompt.txt. Not yet wired into the game. Remove the background and align individual frame bounds before animation: generated poses may extend beyond equal grid cells.
