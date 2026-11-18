#!/bin/sh
# Builds the static page of this package and publishes it on the branch gh-pages, which GitHub Pages
# serves (https://wwf971.github.io/map-styles/). The repository is the package; the branch is a git
# worktree beside the repository's folder, ../gh-pages; the build goes to ../dist first (react-doc
# builds outside the doc page). Made after react-doc-zene-incubator's script of the same name.
#
#   sh script-build/pages-deploy.sh          react-doc is found beside the repository, or at REACT_DOC_DIR
set -e
here=$(cd "$(dirname "$0")/.." && pwd)
repo=$(git -C "$here" rev-parse --show-toplevel)
react_doc=${REACT_DOC_DIR:-$(cd "$repo/../../react-doc" && pwd)}
out="$repo/../dist"
site="$repo/../gh-pages"

# the build is made from what is committed, exported to a folder of its own: a file the checkout has
# and git does not (the playground, a map being tried out) is never published. The libraries the
# components import (@wwf971/react-comp-misc, mobx, rbush) come with the react-doc checkout.
exported=$(mktemp -d)
git -C "$repo" archive HEAD | tar -x -C "$exported"
node "$react_doc/main/frontend/cli/doc-cli.js" build "$exported" --out "$out" --force
rm -r "$exported"

# the worktree of the branch gh-pages: the branch of the remote when it exists, else a new branch
# without history (made inside a detached worktree, which git of every version can do)
if [ ! -e "$site/.git" ]; then
	if git -C "$repo" fetch -q origin gh-pages 2>/dev/null; then
		git -C "$repo" worktree add -B gh-pages "$site" origin/gh-pages
	else
		git -C "$repo" worktree add --detach "$site"
		git -C "$site" checkout -q --orphan gh-pages
		git -C "$site" rm -rq --cached . 2>/dev/null || true
	fi
fi

# the files of the build, nothing else; .nojekyll: every file served as it is
find "$site" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R "$out"/. "$site"/
touch "$site/.nojekyll"
git -C "$site" add -A
if git -C "$site" diff --cached --quiet 2>/dev/null && git -C "$site" rev-parse -q --verify HEAD >/dev/null; then
	echo "the page did not change"
else
	git -C "$site" commit -q -m "build the static page from $(git -C "$repo" rev-parse --short HEAD)"
fi
# a build is tens of MB in hundreds of files: over https git needs a larger buffer to send it at once
git -C "$site" config http.postBuffer 524288000
git -C "$site" push -u origin gh-pages
