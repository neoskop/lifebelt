![Logo](logo.png)

# Lifebelt

_lifebelt_ is small Typescript app that can back up different databases and upload them to an SFTP server in a unified manner. The most common use case is to run as a sidecar container in a Kubernetes pod thus giving the tool its nautical name.

## Providers

Lifebelt can currently only back up the following DBMS:

- MySQL (Docker image: `neoskop/lifebelt-mysql`)
- Couchbase (Docker image: `neoskop/lifebelt-couchbase`)
- CouchDB (Docker image: `neoskop/lifebelt-couchdb`)

Pull requests for additional providers are much welcome!

## Quickstart

To run an example container for a provider you just need to have [Docker](https://www.docker.com) and [Docker Compose](https://docs.docker.com/compose/) installed. Subsequently run:

```sh
$ DEVELOPMENT=true ./build.sh # This will create the necessary docker images without trying to push them
$ cd <provider-name>
$ docker-compose up
```

## Usage

To see a detailed list of options start a container passing the `-h` flag:

```sh
$ docker run neoskop/lifebelt-mysql:latest -h
```

There are currently six different main commands that lifebelt can execute:

1. `cron`: Will run nightly backups
2. `backup`: Will create a backup immediately
3. `test-backup`: Will create a test backup without saving it
4. `clean`: Removes stale backups
5. `restore`: Restores the latest daily dump
6. `providers`: List all available providers

To set-up SFTP credentials and other config options, either supply them by environment variable (As seen in the `docker-compose.yml` files) or by config file (Via `-c`). To see which options are available, look at the [config.ts](./base/src/config.ts) and provider sources.

## Release

To release a new version ensure that the version was adjusted in the [package.json](./base/package.json) and that a tag for this was version was created in the repository. Afterwards you just need to run

```sh
$ ./release.sh
```

to create and push new docker images.

## ToDo

- Implement restoring
  - MySQL
  - Couchbase
- Implement verification
- Add more providers
  - MongoDB
- Add k8s examples
  - As a sidecar in a pod
  - As a CronJob resource
- Add warning for anomalies in sizes

## License

This project is under the terms of the Apache License, Version 2.0. A [copy of this license](LICENSE) is included with the sources.