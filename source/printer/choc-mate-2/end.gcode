;END CODE
G92 E0 ; reset extruder
G1 F3600 E-0.5 ; retract
M400 ; finish all current moves and and thus clear the buffer.
G91 ; set to relative positioning
G1 Z3 ; move up by 3mm
G90 ; set to absolute positioning
G1 X335 Y232 ; move to start position
