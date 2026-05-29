import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const inputFileName = 'RIDER ELSA Y ELMAR 2025 -FULL BAND - Venue Shows 030725.pdf';
const outputFileName = 'RIDER ELSA Y ELMAR 2025 - English Side-by-Side.pdf';
const englishOnlyFileName = 'RIDER ELSA Y ELMAR 2025 - English Translation.pdf';
const visualPageNumbers = new Set([11, 12, 13, 14, 15, 16]);

const translations = [
  String.raw`TECH RIDER | Full Band 2025

Updated September 2025

PLEASE OMIT PREVIOUS VERSIONS

Production Manager:
Manuel Gonzalez
+52 55 54 74 70 48
magcs81@gmail.com`,

  String.raw`CONTENTS

1. Intro
2. Notes
3. Permits
4. Support, Stage
5. Technical Specifications
6. Input - Output
7. Stage Plot
8. Lighting and Lightplot
9. Backline
10. Soundcheck
11. Transportation
12. Lodging
13. Dressing Rooms
14. Catering

1- INTRO

It is a pleasure for our team to connect with you for the development of our show. First, we would like to thank you for receiving this rider, where you will find all the details necessary for the proper development of our performance.

This document is an integral part of the agreement between the Promoter and the artist. All expenses related to compliance with it are the responsibility of the promoter. Failure to comply with what is stated in this document may result in cancellation of the show.

If any part of this technical rider cannot be fulfilled, please contact the Production Manager in advance. Every agreement must be made in writing.

It is vitally important that there be a production representative from the PROMOTER at the show site from the CREW's arrival at the venue until all show-related elements have departed. This representative must have decision-making authority over all matters concerning production and the show.`,

  String.raw`[Intro continued]

There must also be a representative who can make decisions on logistical matters.

2- NOTES

PRODUCTION CONTROL

The promoter/business representative accepts that ELSA Y ELMAR's production has full control and may make decisions on all show-related matters: schedules, stage, barricades, access to the venue, opening bands, announcements of any kind, advertising in the venue, control of house lights, air conditioning, heating, photographers, video, closed circuit, accreditations, etc.

3- PERMITS

PERMITS, LICENSES AND CERTIFICATES

If it is necessary to obtain and/or pay for any kind of licenses, permits, insurance, certificates, visas and/or any process required by any union, local or national authority, authors' society and/or similar body with jurisdiction over the performances, these processes and charges will be the responsibility of the Promoter or Contracting Party.

4- SUPPORT - STAGE

THIS MUST BE DISCUSSED IN ADVANCE WITH ELSA Y ELMAR'S PRODUCTION MANAGER

- Manuel Gonzalez: magcs81@gmail.com

GROUND SUPPORT

Minimum dimensions must be 12 m wide x 9 m high x 10 m deep, roofed.

In addition: FOH, work areas and monitors must also be roofed and have mesh on the back and sides. Spaces are to be defined depending on each production.`,

  String.raw`STAGE

The stage must be 14 m wide x 10 m deep at a height of 1.50 m. It must have a safety railing across the entire rear, stage left and stage right, surrounding the whole stage. It must have 2 work areas with at least the following dimensions:

- 3.66 m x 10 m Stage Left
- 4.88 m x 6.10 m Stage Right
- 06 fans: 01 for guitar, 01 for bass, 01 for drums and 03 for the front of the stage.

NOTES

The entire stage must be black or gray, completely smooth, without reliefs or protrusions, level, and without perforations or holes.

STAGE ACCESS

The stage must have 3 access stairways, positioned as follows:

- Rear area (UPSTAGE CENTER)
- Stage Left
- Stage Right

The stairs must have railings on both sides. Access points must have enough lighting for safe walking.

Cleaning staff access to the stage will be authorized only by the Stage Manager.

The stage must have one trash bin at Stage Left, one at Stage Right, and one at the stage exit.

STAGE SAFETY AND MATERIALS

The stage must be built with solid structures and good materials. It must be perfectly smooth, with no separation between deck panels.

STAGE MASKING

The stage must be perfectly masked with black fabric in perfect condition, creating a black box.

GEAR SPACE

The Promoter must define a secure area, protected from weather, to store all equipment cases from vendors and the Artist so that they are not at risk of damage from weather conditions.`,

  String.raw`[Gear space/weather protection continued]

This includes flooding, rain, dust, extreme temperatures, sun, etc.

MEDICAL SERVICES

It is vitally important to have an ambulance with paramedics from load-in through load-out. The paramedics must introduce themselves to the Production Manager upon arrival and at every shift change, if applicable.

BARRICADE

We require the ENTIRE stage to have HEAVY barricade across the front of the stage (Mojo type).

RISERS

We do not need risers for our show. All members perform on the stage floor.

GENERATORS

The use of at least 2 power generators is essential. The general local producer must calculate the capacity needed to power all equipment (audio, lighting, motors, video, backline, monitoring, etc.). Voltage must be 1800 amps divided into three phases at 110-125 volts, 60 Hz. The entire system must be grounded. There must be physical ground at all points of the system and the stage network.

5- TECHNICAL SPECIFICATIONS

P.A. SYSTEM

A professional 4-way stereo system is required, capable of uniformly delivering 105 to 110 dB, C-weighted, throughout the venue, in phase between ways and without polarity problems. The number and distribution of speakers will depend on the venue, with the goal of providing a minimum 110 dB SPL across the entire audience area (front fill is indispensable), with a flat frequency range of +/- 3 dB from 25 Hz to 18 kHz. Headroom of 120 dB, free of distortion, with no phase or polarity problems, stereo configuration output through matrices (L+R+Subs+Front Fill), not mono please.

- Front Fill: Depending on the stage opening, 4 to 6 boxes of the same brand as the main audio system are required and must be fully phase-compatible.

All systems must be previously aligned physically and/or electronically, with original factory amplification and processing; preferred brands:`,

  String.raw`Preferred brands:
L-Acoustics, Meyer Sound, JBL (VTX V Series)

AMPLIFICATION

As suggested by the manufacturer.

PROCESSORS

At FOH position, also as suggested by the manufacturer.

SUGGESTED BRANDS AND QUANTITIES:

- D&B J8 TOPS x J SUBS
- L'ACOUSTIC V-DOSC TOPS x SB218 SUBS
- ADAMSON Y18 TOPS x T21 SUBS
- NEXO GEOD TOPS x GEO CD18 SUBS

THE AMOUNT OF EQUIPMENT WILL BE IN PROPORTION TO THE VENUE CAPACITY AND SUBJECT TO AUTHORIZATION BY THE PRODUCTION MANAGER.

SUB-SYSTEMS

Where required, out fills, down fills and delays should preferably match the main system. These, and their processor, must be the same brand as the main system.

FOH MISCELLANEOUS

We request a systems engineer for alignment and assistance to ELSA Y ELMAR's sound staff. The house position must be centered, preferably at ground level; if circumstances require it to be raised, it must be on risers no more than 50 cm high and no more than 30 m from the stage. IT MUST BE COVERED FROM SUN AND RAIN AT ALL TIMES WITH A PROFESSIONAL TENT, NOT IMPROVISED CANOPIES, AND THERE MUST ALSO BE AN INTERCOM BETWEEN FOH AND MONITORS.

FOH CONSOLE

FOH (HOUSE AND MONITORS ARE RUN FROM HOUSE)

WE CARRY OUR OWN AUDIO CONSOLE, FROM WHICH WE RUN FOH AND MONITORS. PLEASE CONFIRM TRANSPORT OF THIS CONSOLE WITH OUR PRODUCTION TEAM.

IF WE DO NOT BRING OUR CONSOLE, THESE ARE OUR ALTERNATIVES:

- Yamaha CL5 / Avid S6L 32d / Waves LV1 (48 ch)`,

  String.raw`At the FOH position there must be a self-powered speaker with a microphone with a switch for the TalkBack system.

MONITORING:

In-Ear Monitors / RF

- 08x IEM systems + 6 extra bodypacks:
- Shure PSM 1000
- 08x SE215 earphones
- 02x 8-channel antenna combiners
- 02x Helical antennas
- 02x EW-DX EM with instrument bodypack and half-wave antenna

- MICROPHONES ACCORDING TO INPUT LIST -

ELSA'S WIRELESS SYSTEMS ARE HANDLED BY OUR PRODUCTION

- 02 Sennheiser EW300 G4 / (provided by us)

ELSA Y ELMAR TRAVELS WITH MAIN AND SPARE SENNHEISER VOCAL MICROPHONES, FREQUENCY RANGE AW+ 470-558 MHz. THIS IS REVIEWED CASE BY CASE WITH THE PRODUCTION MANAGER.

01 in-house in-ear system with 2 bodypacks

All wireless and wired systems must include headphones. An RF technician must be present from load-in until the end of the show, monitoring all wireless systems at all times. All systems must have antenna distributors and enough antennas for perfect operation.

LOCAL PRODUCTION RESPONSIBILITY

Please plan to provide 02 Cat 6 cables, 96 m each, in perfect condition, for our audio console, from FOH to stage SL.

6- INPUT AND OUTPUT

INPUT LIST

CH | SOURCE | MIC/DI | NOTES | STAND
1 | Kick in | e901`,

  String.raw`INPUT LIST continued

CH | SOURCE | MIC/DI | NOTES | STAND
2 | Kick out | e902 | | Mini Boom
3 | Snare top | e906 | | Short Boom
4 | Snare bot | e904 | | Clamp
5 | Snare top 2 | e906 | | Short Boom
6 | Snare bot 2 | e904 | | Clamp
7 | Hh | e914 | | Tall Boom
8 | Rack tom 13" | e904 | | Clamp
9 | Floor tom 16" | e904 | | Clamp
10 | Floor tom 18" | e904 | | Clamp
11 | Oh L | e914 | | Tall Boom
12 | Oh R | e914 | | Tall Boom
13 | Roland SPD L | Radial PRO DI
14 | Roland SPD R | Radial PRO DI
15 | Seq Perc L | playaudio 1 XLR
16 | Seq Perc R | playaudio 2 XLR
17 | Seq Arm L | playaudio 3 XLR
18 | Seq Arm R | playaudio 4 XLR
19 | Seq Bgv L | playaudio 5 XLR
20 | Seq Bgv R | playaudio 6 XLR
21 | Smpte | playaudio 7 XLR
22 | Click | playaudio 8 XLR
23 | Moog | Radial PRO DI
24 | [source blank in extracted text] | Radial PRO DI
25 | BASS | Radial PRO DI`,

  String.raw`INPUT LIST continued

CH | SOURCE | MIC/DI | NOTES | STAND
26 | GTR L | SM57 | | Short Boom
27 | GTR L | SM57 | | Short Boom
28 | Mini Juno L | Radial PRO DI
29 | Mini Juno R | Radial PRO DI
30 | Nord L | Radial PRO DI
31 | Nord R | Radial PRO DI
32 | Acoustic GTR Elsa | Radial PRO RMP & Radial PRO DI | Wireless Ew-DX
33 | Electric GTR Elsa | Radial PRO RMP | Wireless Ew-DX
34 | Vox main ELSA | Ew 500 G4 W/935 | Wireless | Straight Stand
35 | Vox SPARE | Ew 500 G4 W/935 | Wireless | Tall Boom
36 | Vox JULIAN (gtr) | e935 | | Tall Boom
37 | Talkback ELSA | e835 | | Tall Boom
38 | Talkback DRUMS | e835 w/ OPTOGATE | | Tall Boom
39 | Talkback BASS | e835 w/ OPTOGATE | | Tall Boom
40 | Talkback GTR | e835 w/ OPTOGATE | | Tall Boom
41 | Talkback Stage L | e835s Switch | | Tall Boom
42 | Talkback Stage R | e835s Switch | | Tall Boom
43 | Talkback PROD | e835s Switch | | Tall Boom
44 | LOCAL FOH 1 | e835s Switch | | Tall Boom`,

  String.raw`MONITOR MIX OUTPUT PATCH

OUTPUT | SOURCE | TYPE | OBS.
1 & 2 | 1. MAIN - ELSA | IN EAR (STEREO)
3 & 4 | 2. DRUM - JUAN | IN EAR (STEREO)
5 & 6 | 3. BASS - DANIEL | IN EAR (STEREO)
7 & 8 | 4. GUITAR - JULIAN | IN EAR (STEREO)
9 & 10 | 5. SPARE | IN EAR (STEREO)
11 & 12 | 6. STAFF | IN EAR (STEREO) | 4 X BODYPACK
13 & 14 | 7. GUEST | IN EAR (STEREO)
15 & 16 | 8. CUE | IN EAR (STEREO)

FOH OUTPUT PATCH

OUTPUT | SOURCE | OBS.
FOH 1 | SMPTE TO LIGHTING & VIDEO CONSOLE
FOH 2 | TALK BACK SPEAKER
FOH 3 & 4 | LIGHT & VIDEO MIX (WIRELESS STEREO IN EAR) | 2 X BODYPACK
FOH 5 & 6 | MAIN LR
FOH 7 | SUB`,

  String.raw`FOH 8 | FRONT FILL

7- STAGE PLOT

The original page at left contains the stage plot drawing for verification.`,

  String.raw`8- LIGHTING AND LIGHTPLOT

This list must be functioning perfectly. All cabling, machines, consoles, etc. must be in optimal condition.`,

  String.raw`IMAGE-ONLY PAGE

No extractable text was present in the PDF text layer for this page. The original page is embedded at left so the lighting/lightplot diagram can be verified visually.`,

  String.raw`IMAGE-ONLY PAGE

No extractable text was present in the PDF text layer for this page. The original page is embedded at left so the lighting/lightplot diagram can be verified visually.`,

  String.raw`IMAGE-ONLY PAGE

No extractable text was present in the PDF text layer for this page. The original page is embedded at left so the lighting/lightplot diagram can be verified visually.`,

  String.raw`IMAGE-ONLY PAGE

No extractable text was present in the PDF text layer for this page. The original page is embedded at left so the lighting/lightplot diagram can be verified visually.`,

  String.raw`GENERATOR / POWER

Three generators will be required: one for audio and video, one for lighting, and one spare. Each generator must have enough cabling to deliver power to stage level.

Generator capacity must be as follows:

- Audio and Video - 200 kVA
- Lighting - 150 kVA
- Spare - 200 kVA

They must have, at minimum, one load center for audio, one for lighting and one for video. Electrical power must consist of 3 phases, neutral and physical ground (with a rod buried at least 2 meters deep) for each generator. Connections must use Cam-Lock connectors. Power distribution on stage must be done with extensions using grounded Edison connectors and provide between 110 and 127 volts, with no ground return, and with correct Ground-Hot-Neutral order. The same generator that supplies the stage must supply the [sentence appears incomplete in the extracted text].

Failure to comply with these conditions will cause delays not attributable to the production and must be compensated.`,

  String.raw`[Generator / power continued]

Any damage caused to the Artist's equipment by the electrical network must be repaired by the event production at the time of the incident, and its cost must be fully reimbursed.

It is extremely important that all cabling used be perfectly organized. Yellow Jackets must be used at any access point for talent and Crew.

9- BACKLINE

Drums - GRETSCH CLASSIC MAPLE / DW COLLECTORS / YAMAHA HYBRID MAPLE

- 22" kick drum
- 13" rack tom
- 16" floor tom with legs
- 18" floor tom with legs
- Main 14" x 6" or 14" x 8" snare (Supraphonic, Black Magic or similar)
- Snare 2: 14" x 6" Maple (Gretsch Brooklyn USA or similar)
- Spare snare 14" x 6"
- 03x snare stands
- 04x cymbal stands with boom
- 01x DW 5000 or similar hi-hat stand (with clutch and all felts), not Yamaha brand**
- 01x kick pedal
- 01x rug
- 01x set of Remo Ambassador Coated heads
- 01x DW Airlift 9000 Series throne, no backrest, round seat (62 cm height), not motorcycle seat**

Bass

- Option #1: Ampeg SVT-Classic amp; Ampeg 8x10 cabinet
- Option #2: Aguilar Tone Hammer 700 amp; DB 810 cabinet
- Option #3: Aguilar DB 751 amp; DB 810 cabinet`,

  String.raw`Guitar

- 01x Fender Twin Reverb 2x12
- 01x Hot Rod 2x12
- 01x Spare Fender Twin Reverb 2x12

Miscellaneous

- 04x simple Hercules keyboard stands
- 06x Hercules instrument stands
- 02x 7-space guitar stands
- 06x percussion tables
- 06x 1/4" plugs, 17 ft

RISERS

- We do not have risers for this show.

VIDEO

- 1 x LED screen, pitch 3.9, 12 x 5 m
- 16:9 aspect ratio
- Preferred screen resolution: 1920 x 1080 (1280 x 720 usable)
- Please send pixel map

10- SOUNDCHECK

Setup and soundcheck are closed-door. Security staff are required to ensure that only Elsa y Elmar production personnel are in the venue. ELSA Y ELMAR Production reserves the right of entry and permanence for any person during soundcheck.

Elsa y Elmar requires a minimum of 6 hours to perform soundcheck starting from our Crew's Load-In.

11- TRANSPORTATION

GROUND TRANSPORTATION:

Two vans for 20 passengers each (Sprinter) and one cargo van for ELSA Y ELMAR production equipment must be provided.

They must be in excellent condition, minimum model year 2020, clean inside and outside.`,

  String.raw`[Ground transportation continued]

This transportation must be fully available. Drivers must treat our musicians and staff well before, during and after the show, with no limit on time or route.

AIR TRANSPORTATION:

For trips longer than 5 hours, travel by plane is required. If there is excess baggage weight, the contracting party will be responsible for paying that cost.

Please plan for 02 plane tickets in AM Plus class (first row of economy, together) and 06 economy-class plane tickets, all including one 25 kg suitcase, plus 02 passengers with 2 suitcases of 25 kg.

Flights must be as direct as possible, without layovers. Authorized itineraries will be delivered by the Tour Manager and may not be modified without prior authorization from the ELSA Y ELMAR team.

12- LODGING

The hotel must be 5-star or a recognized chain and must provide 24-hour room service and breakfast included. Before booking, information must be sent for the artist's authorization.

Required: 1 Jr. Suite, 7 Single Rooms and 2 Double Rooms with Internet Included.

01 Jr Suite - Elsa Carvajal
01 Single - Julian Bernal
02 Single - Production Manager
03 Single - Tour Manager
04 Single - Bassist
05 Single - Drummer
06 Single - MUA + Personal Assistant
07 Single - Audio Engineer
01 Double - Staff + Staff
02 Double - VJ + Lighting Engineer`,

  String.raw`IMPORTANT:

All transportation, lodging and catering must be previously reviewed and authorized with the Tour Manager.

13- DRESSING ROOMS

03 dressing rooms of at least 5 m x 5 m will be necessary. They must be lockable, available when the crew arrives at the venue, tobacco-smoke-free, perfectly ventilated, sanitized, and each must have bottles of antibacterial gel. In addition, they must include the following elements:

Dressing Room 01 - ELSA:

- 01 private bathroom
- 02 comfortable armchairs
- 04 chairs
- 01 full-length mirror
- 01 coat rack or wardrobe rack with hangers
- 02 floor lamps with warm light
- 01 private bathroom inside the dressing room
- 01 catering table
- 04 black face towels (new, previously washed)
- 01 power strip with:
  - 01 latest-generation iPhone charger on loan
  - 01 Android device/charger on loan
  - 06 110v power outlets
- Ventilation and warm lighting
- 01 cooler
- 1 vase with seasonal flowers, e.g. colored carnations, lilies (NO roses or sunflowers)
- 1 scented candle (do not light)
- 01 trash bin

Dressing Room 02 - Musicians:

- 01 private bathroom
- 02 comfortable armchairs
- 04 chairs
- 01 full-length mirror
- 01 coat rack or wardrobe rack with hangers`,

  String.raw`[Dressing Room 02 - Musicians continued]

- 01 floor lamp with warm light
- 01 catering table
- 08 black face towels (new, previously washed)
- 01 power strip with:
  - 01 latest-generation iPhone charger on loan
  - 01 Android device/charger on loan
  - 06 110v power outlets
- Ventilation and warm lighting
- 01 cooler
- 01 trash bin

Dressing Room 03 - Crew:

- 02 comfortable armchairs
- 01 work table
- 06 chairs
- 01 catering table
- 01 floor lamp with warm light
- 01 power strip with:
  - 01 latest-generation iPhone charger on loan
  - 01 Android device/charger on loan
  - 06 110v power outlets
- Ventilation and warm lighting
- 01 cooler
- 01 trash bin

ALL CONTROL OF THE DRESSING ROOM AREA IS UNDER THE RESPONSIBILITY OF ELSA Y ELMAR PRODUCTION AND SECURITY PERSONNEL.

THE RIGHT OF ADMISSION TO THE DRESSING ROOMS IS RESERVED.

14- CATERING

All soundcheck and show catering for ARTIST, MUSICIANS and CREW must be reviewed with the ELSA Y ELMAR production team.

In areas with high temperatures, consider increasing the quantities of liquids available for soundcheck and show.

All disposables must be biodegradable.`,

  String.raw`Dressing Room 03 Catering - Crew (Load In):

Crew / Technical setup time

Upon our CREW's arrival, please have everything set up in dressing room #3 for the exclusive use of ELSA Y ELMAR's Crew.

- 10 bottles of still water, 500 ml
- 05 bottles of mineral water, 500 ml
- Coffee maker with regular coffee, restocked throughout the day
- 06 assorted soft drinks
- 06 Red Bulls
- 06 Gatorades
- 08 assorted Electrolyts
- 04 apples
- 04 bananas
- 10 granola energy bars (Nature Valley type)
- Mixed berries
- Assorted snacks
- Mixed nuts
- 08 black face towels (new or previously washed)
- Clean ice for consumption
- Stage cooler with ice throughout the event for chilling liquids

Dressing Room 01 - ELSA (Soundcheck)

This must be available and set up at least 90 minutes before soundcheck in dressing room #1.

- 08 bottles of water (Santa Maria) or 6 liters of filtered mineral water and biodegradable cups if needed
- 08 bottles of mineral or sparkling water
- 08 Gatorades or Electrolits, assorted flavors
- Black tea and ginger tea
- Regular coffee and decaf coffee
- 01 French press
- 01 water kettle
- 02 fresh ginger roots
- 08 lemons/limes
- Coffee creamer
- 01 carton of unsweetened almond milk
- 02 small unsweetened Greek yogurts`,

  String.raw`[Dressing Room 01 - ELSA Soundcheck continued]

- 01 small box of blueberries
- 01 small box of strawberries
- 01 small box of blackberries
- Cold cuts tray (Serrano ham, turkey, salamis, etc.)
- Dried fruit / nuts
- Almonds
- Pistachios
- Cashews
- 10 granola energy bars (Nature Valley type)
- 02 bags of chips
- Popcorn: cheddar, natural and sweet. Slim Pop brand or similar.

Dressing Room 02 - Musicians (Soundcheck)

This must be available and set up at least 90 minutes before soundcheck in dressing room #2.

- 10 bottles of still water, 500 ml
- 05 bottles of mineral water, 500 ml
- 06 assorted soft drinks
- 03 Red Bulls
- 04 Gatorades
- 04 assorted Electrolyts
- 04 apples
- 04 bananas
- 10 granola energy bars (Nature Valley type)
- Mixed berries
- Assorted snacks
- Mixed nuts
- 08 black face towels (new or previously washed)
- Clean ice for consumption
- Stage cooler with ice throughout the event for chilling liquids

Depending on the timing and duration of soundcheck, consider snacks or food, to be reviewed with ELSA Y ELMAR production.

Dressing Room 01 - ELSA (For the show)

- 08 bottles of water (Santa Maria or Bonafont) or 6 liters of filtered mineral water and biodegradable cups if needed
- 08 bottles of mineral or sparkling water`,

  String.raw`[Dressing Room 01 - ELSA, for the show continued]

- 08 Gatorades or Electrolits, assorted flavors
- Black tea and ginger tea
- Regular coffee and decaf coffee
- 01 French press
- Water kettle
- 02 fresh ginger roots
- 08 lemons/limes
- Coffee creamer
- 01 carton of unsweetened almond milk
- 02 small unsweetened Greek yogurts
- Cold cuts tray (Serrano ham, turkey, salamis, etc.) and seasonal vegetables (jicama, cucumber, cheeses, crudites)
- Dried fruit / nuts (toasted almonds, pistachios; avoid peanuts)
- Granola energy bars (Nature Valley type)
- 02 bags of chips
- Popcorn: cheddar, natural and sweet. Slim Pop brand or similar
- 01 assorted bowl of gummies, lollipops and chocolates
- 01 Valor/Lindt dark chocolate bar (70% cacao)
- Sweet potato, beet, plantain chips and air-popped popcorn
- 02 small unsweetened Greek yogurts
- 01 small box of blueberries
- 01 small box of strawberries
- 01 small box of raspberries
- 01 full-length mirror
- 01 box of Tylenol
- 01 knife and cutting board
- 01 small package of round rubber balloons, medium or small size
- TYPICAL REGIONAL DISHES AND SNACKS. Review available options in advance with the Tour Manager. This must be ready in dressing rooms #2 and #3 at the end of the show.

Dressing Room 02 - Musicians (For the Show)

- 16 bottles of mineralized water (Santa Maria or Bonafont)
- 16 mineral or sparkling waters, ideally Topo Chico
- 10 bottles of Electrolit/Gatorade/Powerade, assorted flavors
- 06 cans of Coca Cola
- 06 cans of Coca Cola Zero
- 08 lemons/limes
- 08 bananas
- Sweet potato, beet, plantain chips and air-popped popcorn
- 01 assorted cheese and cold cuts tray`,

  String.raw`[Dressing Room 02 - Musicians, for the Show continued]

- 04 bags of chips
- 01 medium package of toasted almonds
- 01 medium package of pistachios
- 01 electric heating kettle
- 01 knife and cutting board
- Biodegradable or non-disposable cups
- 01 cooler or mini refrigerator

Dressing Room 03 Catering - Crew (For the show)

- 08 hand towels (not face towels), dark color, new or prewashed, for stage
- 16 bottles of still water
- 10 assorted soft drinks
- 10 mineral waters
- 10 assorted Vitamin Waters
- 10 assorted Gatorades
- 01 assorted cheese and cold cuts tray
- 02 packages of sliced whole wheat bread, 620 g
- 01 400 g package of sliced pork ham
- 01 400 g package of sliced turkey breast ham
- 01 500 g package of sliced Manchego cheese
- 01 400 g package of sliced Panela cheese
- Sliced tomatoes, onion and avocado in separate containers
- 01 small mayonnaise
- 01 small mustard
- 01 can chipotle chile, 220 g
- 01 can jalapeno chile, 220 g
- 01 electric sandwich maker
- 01 bag of clean refrigerated ice
- 01 package of compostable disposable cups (no Styrofoam)
- 01 package of compostable disposable plates (no Styrofoam)
- 01 package of napkins
- 01 package of disposable, compostable forks / spoons / knives
- 01 package of antibacterial towels or antibacterial gel

Dressing Room 01 - ELSA (After the show)

- 01 vegetable or chicken broth
- 01 cut of meat / grilled chicken breast with vegetables
- 01 bag of sea salt`,

  String.raw`Dressing Room 02 - Musicians (After the show)

- 01 bottle of white or rose wine
- 15 cold beers (no Sol or Corona)
- 2 bottles of Mezcal (Amaras/Union/400 Conejos). If the show is outside Mexico, please prioritize local alcohol of your choice.
- Typical regional dishes and snacks, including vegetarian options. Review available options in advance with the Tour Manager. This must be ready in dressing rooms #2 and #3 at the end of the show.

Dressing Room 03 - Crew (After the show)

- 10 cold beers (no Sol or Corona)
- 02 salads (confirm salad type with TM)
- Typical regional dishes and snacks, including vegetarian options. Review available options in advance with the Tour Manager. This must be ready in dressing rooms #2 and #3 at the end of the show.

Please make sure you have a plan for leftover food. We do everything possible to request only the amount needed each day, but please discuss a plan for donating leftover hospitality items, either to a local charity or to venue staff and crew.`,
];

const rootDir = path.resolve(process.cwd());
const inputPath = path.join(rootDir, inputFileName);
const outputPath = path.join(rootDir, outputFileName);
const publicOutputPath = path.join(rootDir, 'web', 'public', outputFileName);
const englishOnlyPath = path.join(rootDir, englishOnlyFileName);
const publicEnglishOnlyPath = path.join(rootDir, 'web', 'public', englishOnlyFileName);

const sourceBytes = readFileSync(inputPath);
const sourcePdf = await PDFDocument.load(sourceBytes);

if (sourcePdf.getPageCount() !== translations.length) {
  throw new Error(`Expected ${sourcePdf.getPageCount()} translations, received ${translations.length}.`);
}

const outputPdf = await PDFDocument.create();
const regular = await outputPdf.embedFont(StandardFonts.Helvetica);
const bold = await outputPdf.embedFont(StandardFonts.HelveticaBold);
const mono = await outputPdf.embedFont(StandardFonts.Courier);
const embeddedPages = [];
const originalTextLayouts = await extractOriginalTextLayouts(sourceBytes);

for (let i = 0; i < sourcePdf.getPageCount(); i += 1) {
  embeddedPages.push(await outputPdf.embedPage(sourcePdf.getPage(i)));
}

const pageWidth = 1224;
const pageHeight = 792;
const margin = 36;
const gutter = 30;
const headerHeight = 28;
const columnWidth = (pageWidth - margin * 2 - gutter) / 2;
const bodyTop = pageHeight - margin - headerHeight;
const bodyHeight = bodyTop - margin;

function wrapLine(line, font, size, maxWidth) {
  if (!line.trim()) return [''];

  const words = line.split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);
    current = word;

    while (font.widthOfTextAtSize(current, size) > maxWidth && current.length > 1) {
      let cut = current.length - 1;
      while (cut > 1 && font.widthOfTextAtSize(`${current.slice(0, cut)}-`, size) > maxWidth) {
        cut -= 1;
      }
      lines.push(`${current.slice(0, cut)}-`);
      current = current.slice(cut);
    }
  }

  if (current) lines.push(current);
  return lines;
}

function layoutText(text, font, size, maxWidth) {
  const lines = [];
  for (const paragraphLine of text.split('\n')) {
    if (!paragraphLine.trim()) {
      lines.push({ text: '', fontKind: 'regular' });
      continue;
    }

    const lineFont = paragraphLine.includes(' | ') ? mono : font;
    for (const wrapped of wrapLine(paragraphLine, lineFont, size, maxWidth)) {
      lines.push({ text: wrapped, fontKind: lineFont === mono ? 'mono' : 'regular' });
    }
  }
  return lines;
}

function pickAlignedTextLayout(text, maxWidth, maxHeight, preferredSize, preferredLineHeight) {
  const sizes = [preferredSize, preferredSize - 0.4, preferredSize - 0.8, preferredSize - 1.2, preferredSize - 1.6, preferredSize - 2, preferredSize - 2.4, 5.8]
    .filter((size, index, list) => size > 0 && list.indexOf(size) === index);

  for (const size of sizes) {
    const lineHeight = Math.max(size * 1.18, preferredLineHeight * Math.min(1, size / preferredSize));
    const lines = layoutText(text, regular, size, maxWidth);
    const weightedCount = lines.reduce((total, line) => total + (line.text ? 1 : 0.7), 0);
    if (weightedCount * lineHeight <= maxHeight) {
      return { size, lineHeight, lines };
    }
  }

  const size = 5.8;
  const lines = layoutText(text, regular, size, maxWidth);
  const weightedCount = lines.reduce((total, line) => total + (line.text ? 1 : 0.55), 0);
  return { size, lineHeight: maxHeight / Math.max(weightedCount, 1), lines };
}

async function extractOriginalTextLayouts(bytes) {
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
    useSystemFonts: true,
  }).promise;
  const layouts = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const pdfPage = await doc.getPage(pageNumber);
    const viewport = pdfPage.getViewport({ scale: 1 });
    const text = await pdfPage.getTextContent();
    const grouped = new Map();

    for (const item of text.items) {
      const value = item.str.trim();
      if (!value) continue;

      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      const key = String(y);
      const line = grouped.get(key) ?? { y, xMin: x, xMax: x + item.width, parts: [] };
      line.xMin = Math.min(line.xMin, x);
      line.xMax = Math.max(line.xMax, x + item.width);
      line.parts.push({ x, value });
      grouped.set(key, line);
    }

    const lines = [...grouped.values()]
      .map((line) => ({
        ...line,
        text: line.parts
          .sort((a, b) => a.x - b.x)
          .map((part) => part.value)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim(),
      }))
      .sort((a, b) => b.y - a.y);

    const gaps = [];
    for (let index = 0; index < lines.length - 1; index += 1) {
      const gap = lines[index].y - lines[index + 1].y;
      if (gap > 0 && gap < 60) gaps.push(gap);
    }
    const medianGap = gaps.length ? gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 16;
    const slots = [];

    for (let index = 0; index < lines.length; index += 1) {
      slots.push(lines[index].y);
      const nextLine = lines[index + 1];
      if (!nextLine) continue;

      const gap = lines[index].y - nextLine.y;
      const extraSlots = Math.max(0, Math.round(gap / medianGap) - 1);
      for (let extra = 1; extra <= extraSlots; extra += 1) {
        slots.push(lines[index].y - medianGap * extra);
      }
    }

    const leftMargin = lines.length ? Math.max(42, Math.min(...lines.map((line) => line.xMin))) : 57;
    const rightMargin = lines.length ? Math.max(42, viewport.width - Math.max(...lines.map((line) => line.xMax))) : 57;

    layouts.push({
      pageWidth: viewport.width,
      pageHeight: viewport.height,
      slots,
      topY: slots[0] ?? viewport.height - 90,
      bottomY: slots[slots.length - 1] ?? 90,
      medianGap,
      leftMargin,
      rightMargin,
    });
  }

  return layouts;
}

function drawHeader(page, label, pageNumber, x) {
  page.drawText(label, {
    x,
    y: pageHeight - margin - 11,
    size: 10,
    font: bold,
    color: rgb(0.12, 0.17, 0.22),
  });
  page.drawText(`Page ${pageNumber}`, {
    x: x + columnWidth - 44,
    y: pageHeight - margin - 11,
    size: 9,
    font: regular,
    color: rgb(0.38, 0.43, 0.48),
  });
}

function drawAlignedTranslation({
  page,
  text,
  sourceLayout,
  frameX,
  frameY,
  frameWidth,
  frameHeight,
  scale,
  fonts,
  drawFrame = false,
}) {
  if (drawFrame) {
    page.drawRectangle({
      x: frameX,
      y: frameY,
      width: frameWidth,
      height: frameHeight,
      borderWidth: 0.75,
      borderColor: rgb(0.78, 0.81, 0.85),
      color: rgb(1, 1, 1),
    });
  }

  const textX = frameX + sourceLayout.leftMargin * scale;
  const maxTextWidth = frameWidth - (sourceLayout.leftMargin + sourceLayout.rightMargin) * scale;
  const topY = frameY + sourceLayout.topY * scale;
  const bottomY = frameY + sourceLayout.bottomY * scale;
  const preferredSize = Math.max(6.2, 11.5 * scale);
  const preferredLineHeight = Math.max(7, sourceLayout.medianGap * scale);
  const maxTextHeight = Math.max(120 * scale, topY - bottomY + preferredLineHeight);
  const layout = pickAlignedTextLayout(text, maxTextWidth, maxTextHeight, preferredSize, preferredLineHeight);
  const scaledSlots = sourceLayout.slots.map((slot) => frameY + slot * scale);

  const drawTextLine = (line, y) => {
    if (!line.text) return;

    const baseFont = line.fontKind === 'mono' ? fonts.mono : fonts.regular;
    const lineFont = shouldEmphasize(line.text) ? fonts.bold : baseFont;
    page.drawText(line.text, {
      x: textX,
      y,
      size: line.fontKind === 'mono' ? layout.size * 0.88 : layout.size,
      font: lineFont,
      color: rgb(0.08, 0.1, 0.13),
    });
  };

  if (layout.lines.length <= scaledSlots.length && scaledSlots.length > 0) {
    let slotIndex = 0;
    for (const line of layout.lines) {
      if (slotIndex >= scaledSlots.length) break;
      drawTextLine(line, scaledSlots[slotIndex]);
      slotIndex += 1;
    }
    return;
  }

  let y = topY;
  const bottomLimit = frameY + 34 * scale;
  for (const line of layout.lines) {
    if (y < bottomLimit) break;
    drawTextLine(line, y);
    y -= line.text ? layout.lineHeight : layout.lineHeight * 0.7;
  }
}

for (let i = 0; i < embeddedPages.length; i += 1) {
  const pageNumber = i + 1;
  const page = outputPdf.addPage([pageWidth, pageHeight]);
  const leftX = margin;
  const rightX = margin + columnWidth + gutter;

  page.drawText('Elsa y Elmar Full Band 2025 - English verification copy', {
    x: margin,
    y: pageHeight - 20,
    size: 8,
    font: regular,
    color: rgb(0.45, 0.49, 0.54),
  });

  drawHeader(page, 'Original Spanish', pageNumber, leftX);
  drawHeader(page, 'English Translation', pageNumber, rightX);

  page.drawLine({
    start: { x: margin + columnWidth + gutter / 2, y: margin },
    end: { x: margin + columnWidth + gutter / 2, y: bodyTop + 4 },
    thickness: 0.6,
    color: rgb(0.82, 0.85, 0.88),
  });

  page.drawRectangle({
    x: leftX,
    y: margin,
    width: columnWidth,
    height: bodyHeight,
    borderWidth: 0.75,
    borderColor: rgb(0.78, 0.81, 0.85),
  });

  const sourcePageSize = sourcePdf.getPage(i).getSize();
  const scale = Math.min((columnWidth - 10) / sourcePageSize.width, (bodyHeight - 10) / sourcePageSize.height);
  const originalWidth = sourcePageSize.width * scale;
  const originalHeight = sourcePageSize.height * scale;

  page.drawPage(embeddedPages[i], {
    x: leftX + (columnWidth - originalWidth) / 2,
    y: margin + (bodyHeight - originalHeight) / 2,
    width: originalWidth,
    height: originalHeight,
  });

  const rightPageX = rightX + (columnWidth - originalWidth) / 2;
  const rightPageY = margin + (bodyHeight - originalHeight) / 2;

  drawAlignedTranslation({
    page,
    text: translations[i],
    sourceLayout: originalTextLayouts[i],
    frameX: rightPageX,
    frameY: rightPageY,
    frameWidth: originalWidth,
    frameHeight: originalHeight,
    scale,
    fonts: { regular, bold, mono },
    drawFrame: true,
  });
}

function shouldEmphasize(text) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/^\d+\s*-\s+/.test(trimmed)) return true;
  if (/^[A-Z0-9 .,/&()'-]+:$/.test(trimmed)) return true;
  if (/^[A-Z0-9 .,/&()'-]{4,}$/.test(trimmed) && trimmed === trimmed.toUpperCase()) return true;
  return false;
}

function drawMask(page, { x, y, width, height }) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: rgb(1, 1, 1),
  });
}

function drawVisualPageEnglishOverlay(page, pageNumber, fonts) {
  if (pageNumber === 11) {
    drawMask(page, { x: 148, y: 727, width: 190, height: 24 });
    drawMask(page, { x: 50, y: 474, width: 130, height: 24 });
    page.drawText('FOH 8', { x: 157, y: 735, size: 11.5, font: fonts.regular, color: rgb(0.08, 0.1, 0.13) });
    page.drawText('FRONT FILL', { x: 252, y: 735, size: 11.5, font: fonts.regular, color: rgb(0.08, 0.1, 0.13) });
    page.drawText('7- STAGE PLOT', { x: 57, y: 482, size: 11.5, font: fonts.bold, color: rgb(0.08, 0.1, 0.13) });
  }

  if (pageNumber === 12) {
    drawMask(page, { x: 50, y: 486, width: 500, height: 74 });
    page.drawText('8- LIGHTING AND LIGHTPLOT', {
      x: 57,
      y: 543,
      size: 11.5,
      font: fonts.bold,
      color: rgb(0.08, 0.1, 0.13),
    });
    page.drawText('This list must be functioning perfectly. All cabling, machines, consoles, etc.', {
      x: 57,
      y: 510,
      size: 11.5,
      font: fonts.regular,
      color: rgb(0.08, 0.1, 0.13),
    });
    page.drawText('must be in optimal condition.', {
      x: 57,
      y: 494,
      size: 11.5,
      font: fonts.regular,
      color: rgb(0.08, 0.1, 0.13),
    });
  }
}

const translatedBytes = await outputPdf.save();
writeFileSync(outputPath, translatedBytes);

const englishOnlyPdf = await PDFDocument.create();
const englishRegular = await englishOnlyPdf.embedFont(StandardFonts.Helvetica);
const englishBold = await englishOnlyPdf.embedFont(StandardFonts.HelveticaBold);
const englishMono = await englishOnlyPdf.embedFont(StandardFonts.Courier);
const englishVisualPages = new Map();

for (const pageNumber of visualPageNumbers) {
  englishVisualPages.set(pageNumber, await englishOnlyPdf.embedPage(sourcePdf.getPage(pageNumber - 1)));
}

for (let i = 0; i < translations.length; i += 1) {
  const sourcePageSize = sourcePdf.getPage(i).getSize();
  const page = englishOnlyPdf.addPage([sourcePageSize.width, sourcePageSize.height]);
  const pageNumber = i + 1;

  if (visualPageNumbers.has(pageNumber)) {
    page.drawPage(englishVisualPages.get(pageNumber), {
      x: 0,
      y: 0,
      width: sourcePageSize.width,
      height: sourcePageSize.height,
    });
    drawVisualPageEnglishOverlay(page, pageNumber, {
      regular: englishRegular,
      bold: englishBold,
      mono: englishMono,
    });
    continue;
  }

  drawAlignedTranslation({
    page,
    text: translations[i],
    sourceLayout: originalTextLayouts[i],
    frameX: 0,
    frameY: 0,
    frameWidth: sourcePageSize.width,
    frameHeight: sourcePageSize.height,
    scale: 1,
    fonts: { regular: englishRegular, bold: englishBold, mono: englishMono },
  });
}

const englishOnlyBytes = await englishOnlyPdf.save();
writeFileSync(englishOnlyPath, englishOnlyBytes);

const publicDir = path.dirname(publicOutputPath);
if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });
writeFileSync(publicOutputPath, translatedBytes);
writeFileSync(publicEnglishOnlyPath, englishOnlyBytes);

console.log(`Wrote ${outputPath}`);
console.log(`Wrote ${publicOutputPath}`);
console.log(`Wrote ${englishOnlyPath}`);
console.log(`Wrote ${publicEnglishOnlyPath}`);
