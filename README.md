# entity-modules

Optional modules for `entity`. None is needed: an entity installs only the ones
it decides to, and keeps its own copy of their code.

    titles  vocabulary  offices  value  deeds  threads

## Use it beside your entities

Unpack this pack next to your entity directories:

    ~/entities/entity-modules/…      ← this pack
    ~/entities/our-coop/             ← an entity

`pack:NAME` sources then find it. `ENTITY_MODULES=/path/to/entity-modules` points
elsewhere.

## Publish it

Publish the pack as one repository, so each module has a stable, pinned source:

    cd entity-modules
    git init -b main && git add -A && git commit -m "entity modules"
    # GitHub: create the repository, then
    git remote add origin git@github.com:YOU/entity-modules.git && git push -u origin main
    # or Radicle:
    rad init --name entity-modules --default-branch main --public --no-confirm

Then note the commit (`git rev-parse HEAD`) and point `library.yml` in your
entities at it:

    modules:
      offices: github:YOU/entity-modules/offices@COMMIT

Every entity that installs a module records that source and the digest of the
exact code. A later commit is a different module version, installed by a new
decision.
