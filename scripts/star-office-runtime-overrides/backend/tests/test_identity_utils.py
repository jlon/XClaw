import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from identity_utils import parse_identity_name


class ParseIdentityNameTests(unittest.TestCase):
    def test_parses_plain_chinese_name_field(self):
        self.assertEqual(parse_identity_name("# IDENTITY.md\n- 名称：小飞龙\n"), "小飞龙")

    def test_parses_multiline_name_field(self):
        self.assertEqual(parse_identity_name("# IDENTITY.md\n- **Name:**\n  主脑\n"), "主脑")

    def test_ignores_template_placeholder(self):
        self.assertIsNone(parse_identity_name("# IDENTITY.md\n- **Name:**\n  _(pick something you like)_\n"))


if __name__ == "__main__":
    unittest.main()
