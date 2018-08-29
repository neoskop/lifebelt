#!/bin/bash

if [[ "$@" == "/*" ]]; then
  exec $@
else
  cd /home/node
  exec node dist/index.js $@
fi