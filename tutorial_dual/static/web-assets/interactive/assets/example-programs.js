export const YOU_ARE_GREAT = {
  label: 'recognize "you are great"',
  input: 'you are great',
  output: 'accept',
  source: `pos = # true
match1 = (pos == 1) && "y"
match2 = (pos == 2) && "o"
match3 = (pos == 3) && "u"
match4 = (pos == 4) && "a"
match5 = (pos == 5) && "r"
match6 = (pos == 6) && "e"
match7 = (pos == 7) && "g"
match8 = (pos == 8) && "r"
match9 = (pos == 9) && "e"
match10 = (pos == 10) && "a"
match11 = (pos == 11) && "t"
matches = match1 || match2 || match3 || match4 ||
          match5 || match6 || match7 || match8 ||
          match9 || match10 || match11
mismatches = # (!matches)
accept = (pos == 11) && (mismatches == 0)`,
};
