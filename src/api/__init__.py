"""FastAPI control-plane package.

This package is a thin HTTP translation layer over ``ga.run_lifecycle``. It
contains no GA logic and never touches the database driver directly; every
data-access call goes through ``ga.run_lifecycle``.
"""
