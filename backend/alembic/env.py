import subprocess
import argparse
import json
from models import Base
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

# Rewritten portion to print API paths from openapi.json

parser = argparse.ArgumentParser(description='Modify existing file')
subparsers = parser.add_subparsers(dest='command')

edit_parser = subparsers.add_parser('edit', help='Edit an existing file')
edit_parser.add_argument('--filepath', required=True,
                         help='path of the file to be modified')


def load_json(filepath):
    with open(filepath, 'r') as f:
        return json.load(f)


def modify_file(filepath, changes):
    data = load_json(filepath)
    data['changes'] = changes


parser.add_argument('openapi', type=str, nargs='?', default='openapi.json')
args = parser.parse_args()

if args.command == 'edit':
    filepath = args.filepath
else:
    if not hasattr(args, 'filepath'):
        raise ValueError("filepath is required")
    filepath = args.filepath

with open('openapi.json', 'r') as f:
    api_data = json.load(f)

    changes = {
        "name": "edit_existing_file",
        "arguments": {
            "filepath": filepath,
            "changes": "// ... existing code ...\n\nfrom fastapi.middleware.cors import CORSMiddleware\napp.add_middleware(CORSMiddleware, allow_origins=[\"*\"], allow_credentials=True, allow_methods=[\"*\"], allow_headers=[\"*\"])\n// ... rest of code ..."
        }
    }

    modify_file(filepath, changes)
    subprocess.run(['cat', filepath])

if __name__ == "__main__":
    main()
