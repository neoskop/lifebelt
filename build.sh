#!/bin/bash
set -e
version=$(git tag --sort=-v:refname | head -n 1)

if [ -z "$DEVELOPMENT" ]; then
  DEVELOPMENT="false"
fi

if [ -z "$version" ] || [[ "$DEVELOPMENT" == "true" ]]; then
  version="latest"
fi

build_provider() {
    docker build -f $1/Dockerfile -t neoskop/lifebelt-$1:$version $1

    if [[ "$DEVELOPMENT" == "false" ]]; then
      docker push neoskop/lifebelt-$1:$version
    fi
}

docker build -f base/Dockerfile -t neoskop/lifebelt-base:latest base
build_provider "couchbase"
build_provider "mysql"
