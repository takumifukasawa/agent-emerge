// Copy a fixture home into a fresh temp dir and make it real:
// - "__HOME__" in file contents → the temp home's absolute path
// - "__HOME_ENC__" in directory names → that path encoded the way Claude Code names project dirs
// - dev/skills-repo becomes a git repo with an upstream, one unpushed commit and one uncommitted change
// The repo itself never stores a real path (scripts/check-no-leaks.sh); this is where paths appear, at test time only.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync, lstatSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'

export type FixtureName = 'home' | 'clean-home'

export interface MaterializedFixture {
  home: string
  cleanup(): void
}

/** Claude Code names a project dir by replacing every non-alphanumeric char of its absolute path with "-". */
export function encodeProjectPath(absPath: string): string {
  return absPath.replace(/[^A-Za-z0-9]/g, '-')
}

function walk(dir: string, visit: (path: string, isDir: boolean) => void): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = lstatSync(full)
    if (st.isSymbolicLink()) continue
    if (st.isDirectory()) walk(full, visit)
    visit(full, st.isDirectory())
  }
}

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, {
    cwd,
    stdio: 'ignore',
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_SYSTEM: '/dev/null',
      GIT_AUTHOR_NAME: 'fixture',
      GIT_AUTHOR_EMAIL: 'fixture@invalid',
      GIT_COMMITTER_NAME: 'fixture',
      GIT_COMMITTER_EMAIL: 'fixture@invalid'
    }
  })
}

function makeSourceRepo(home: string): void {
  const repo = join(home, 'dev/skills-repo')
  if (!existsSync(repo)) return
  const remote = join(home, 'dev/skills-repo-remote.git')
  git(home, 'init', '-q', '--bare', '-b', 'main', remote)
  git(repo, 'init', '-q', '-b', 'main')
  git(repo, 'add', '-A')
  git(repo, 'commit', '-q', '-m', 'initial')
  git(repo, 'remote', 'add', 'origin', remote)
  git(repo, 'push', '-q', '-u', 'origin', 'main')
  writeFileSync(join(repo, 'shared-skill/notes.md'), 'reference notes for shared-skill\nunpushed line\n')
  git(repo, 'commit', '-q', '-am', 'unpushed change')
  writeFileSync(join(repo, 'shared-skill/notes.md'), 'reference notes for shared-skill\nunpushed line\nuncommitted line\n')
}

export function materializeFixture(name: FixtureName = 'home'): MaterializedFixture {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'agent-emerge-fixture-')))
  const home = join(base, 'home')
  cpSync(join(import.meta.dirname, name), home, { recursive: true, verbatimSymlinks: true })

  const dirs: string[] = []
  walk(home, (p, isDir) => {
    if (isDir) {
      if (basename(p).includes('__HOME_ENC__')) dirs.push(p) // children are visited first (post-order)
      return
    }
    const text = readFileSync(p, 'utf8')
    if (text.includes('__HOME__')) writeFileSync(p, text.replaceAll('__HOME__', home))
  })
  for (const d of dirs) renameSync(d, join(dirname(d), basename(d).replaceAll('__HOME_ENC__', encodeProjectPath(home))))

  makeSourceRepo(home)
  return { home, cleanup: () => rmSync(base, { recursive: true, force: true }) }
}
