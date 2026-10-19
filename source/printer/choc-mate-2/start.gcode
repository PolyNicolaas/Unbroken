G21 ; set units to mm
G90 ; set to absolute positioning
M80 ; turn on the power supply
T0 ; select tool 0
G92 E0 ; reset extruder
@nosize
G1 X80.0 Y232 Z10 F3000.0 ; move to start position
G1 E0.9 ; undo retraction
G1 X30.0 E1.3 F150 ; extrude and move
G92 E0 ; reset extruder
G1 X25.0 F900 ; move to side a little
;G4 S2 ; wait 2 seconds
G1 Z4 F5000 ; Move bed up a bit
G1 X20.0 ; move to side a little again
G1 Z2 F5000 ; Move bed up a bit
@size
G1 Z2 F3600
G92 E0 ; reset extruder
M82 ; set extruder to absolute mode
