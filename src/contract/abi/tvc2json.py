#!/usr/bin/python3

import sys

tvc = sys.argv[1]
with open(tvc, 'rb') as f:
    boc = f.read()

import base64

with open(tvc + '.json', 'w') as f:
    f.write('{ "code": "' + base64.b64encode(boc).decode('utf-8') + '" }')
