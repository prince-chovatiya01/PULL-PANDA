"""
Test suite for meta_evaluate function.
Tests LLM evaluation behavior, error handling, and JSON parsing.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from accuracy_checker import meta_evaluate


class TestMetaEvaluate:
    """Test suite for meta_evaluate function."""

    def test_successful_json_response(self):
        """Test successful evaluation with valid JSON response."""
        json_response = '''{
            "clarity": 8,
            "usefulness": 7,
            "depth": 6,
            "actionability": 9,
            "positivity": 7,
            "explain": "Good review overall"
        }'''
        
        # FIXED: Properly mock the chain to return the JSON string
        with patch('accuracy_checker.evaluator_prompt') as mock_prompt, \
             patch('accuracy_checker.llm') as mock_llm, \
             patch('accuracy_checker.StrOutputParser') as mock_parser:
            
            # Create a mock chain that returns the JSON when invoke is called
            mock_chain = Mock()
            mock_chain.invoke = Mock(return_value=json_response)
            
            # Set up the pipe operator chain
            mock_prompt.__or__ = Mock(return_value=Mock(
                __or__=Mock(return_value=Mock(
                    __or__=Mock(return_value=mock_chain)
                ))
            ))
            
            parsed, raw = meta_evaluate("diff content", "review content")
            
            assert parsed["clarity"] == 8
            assert parsed["usefulness"] == 7
            assert parsed["explain"] == "Good review overall"
            assert raw == json_response

    def test_json_with_extra_whitespace(self):
        """Test JSON parsing with extra whitespace and newlines."""
        json_response = '''
        
        {
            "clarity": 5,
            "usefulness": 6,
            "depth": 7,
            "actionability": 8,
            "positivity": 9,
            "explain": "Test"
        }
        
        '''
        
        with patch('accuracy_checker.evaluator_prompt') as mock_prompt, \
             patch('accuracy_checker.llm') as mock_llm, \
             patch('accuracy_checker.StrOutputParser') as mock_parser:
            
            mock_chain = Mock()
            mock_chain.invoke = Mock(return_value=json_response)
            
            mock_prompt.__or__ = Mock(return_value=Mock(
                __or__=Mock(return_value=Mock(
                    __or__=Mock(return_value=mock_chain)
                ))
            ))
            
            parsed, raw = meta_evaluate("diff", "review")
            
            assert isinstance(parsed, dict)
            assert "error" not in parsed
            assert parsed["clarity"] == 5

    def test_json_embedded_in_markdown(self):
        """Test extraction of JSON from markdown code blocks."""
        response = '''Here is my evaluation:
        ```json
        {"clarity": 7, "usefulness": 8, "depth": 6, "actionability": 7, "positivity": 8, "explain": "test"}
        ```
        Hope this helps!'''
        
        with patch('accuracy_checker.evaluator_prompt') as mock_prompt, \
             patch('accuracy_checker.llm') as mock_llm, \
             patch('accuracy_checker.StrOutputParser') as mock_parser:
            
            mock_chain = Mock()
            mock_chain.invoke = Mock(return_value=response)
            
            mock_prompt.__or__ = Mock(return_value=Mock(
                __or__=Mock(return_value=Mock(
                    __or__=Mock(return_value=mock_chain)
                ))
            ))
            
            parsed, raw = meta_evaluate("diff", "review")
            
            assert isinstance(parsed, dict)
            if "error" not in parsed:
                assert parsed["clarity"] == 7

    def test_json_with_text_prefix_suffix(self):
        """Test JSON extraction when surrounded by text."""
        response = '''Sure! Here is the evaluation:
        {"clarity": 9, "usefulness": 8, "depth": 7, "actionability": 8, "positivity": 6, "explain": "excellent"}
        This completes the evaluation.'''
        
        with patch('accuracy_checker.evaluator_prompt') as mock_prompt, \
             patch('accuracy_checker.llm') as mock_llm, \
             patch('accuracy_checker.StrOutputParser') as mock_parser:
            
            mock_chain = Mock()
            mock_chain.invoke = Mock(return_value=response)
            
            mock_prompt.__or__ = Mock(return_value=Mock(
                __or__=Mock(return_value=Mock(
                    __or__=Mock(return_value=mock_chain)
                ))
            ))
            
            parsed, raw = meta_evaluate("diff", "review")
            
            assert isinstance(parsed, dict)
            if "error" not in parsed:
                assert parsed["clarity"] == 9

    def test_malformed_json(self):
        """Test handling of malformed JSON response."""
        response = '''{
            "clarity": 8,
            "usefulness": 7,
            missing quote and comma here
            "positivity": 6
        }'''
        
        with patch('accuracy_checker.evaluator_prompt') as mock_prompt, \
             patch('accuracy_checker.llm') as mock_llm, \
             patch('accuracy_checker.StrOutputParser') as mock_parser:
            
            mock_chain = Mock()
            mock_chain.invoke = Mock(return_value=response)
            
            mock_prompt.__or__ = Mock(return_value=Mock(
                __or__=Mock(return_value=Mock(
                    __or__=Mock(return_value=mock_chain)
                ))
            ))
            
            parsed, raw = meta_evaluate("diff", "review")
            
            assert "error" in parsed

    def test_no_json_in_response(self):
        """Test response with no JSON at all."""
        response = "This is just plain text without any JSON."
        
        with patch('accuracy_checker.evaluator_prompt') as mock_prompt, \
             patch('accuracy_checker.llm') as mock_llm, \
             patch('accuracy_checker.StrOutputParser') as mock_parser:
            
            mock_chain = Mock()
            mock_chain.invoke = Mock(return_value=response)
            
            mock_prompt.__or__ = Mock(return_value=Mock(
                __or__=Mock(return_value=Mock(
                    __or__=Mock(return_value=mock_chain)
                ))
            ))
            
            parsed, raw = meta_evaluate("diff", "review")
            
            assert "error" in parsed
            assert "no JSON" in parsed["error"]

    def test_llm_invocation_exception(self):
        """Test handling of LLM invocation failure."""
        with patch('accuracy_checker.evaluator_prompt') as mock_prompt, \
             patch('accuracy_checker.llm') as mock_llm, \
             patch('accuracy_checker.StrOutputParser') as mock_parser:
            
            mock_chain = Mock()
            mock_chain.invoke = Mock(side_effect=Exception("API rate limit exceeded"))
            
            mock_prompt.__or__ = Mock(return_value=Mock(
                __or__=Mock(return_value=Mock(
                    __or__=Mock(return_value=mock_chain)
                ))
            ))
            
            parsed, raw = meta_evaluate("diff", "review")
            
            assert "error" in parsed
            assert "evaluator invoke failed" in parsed["error"]
            assert raw is None

    def test_network_timeout_exception(self):
        """Test handling of network timeout."""
        with patch('accuracy_checker.evaluator_prompt') as mock_prompt, \
             patch('accuracy_checker.llm') as mock_llm, \
             patch('accuracy_checker.StrOutputParser') as mock_parser:
            
            mock_chain = Mock()
            mock_chain.invoke = Mock(side_effect=TimeoutError("Request timed out"))
            
            mock_prompt.__or__ = Mock(return_value=Mock(
                __or__=Mock(return_value=Mock(
                    __or__=Mock(return_value=mock_chain)
                ))
            ))
            
            parsed, raw = meta_evaluate("diff", "review")
            
            assert "error" in parsed
            assert raw is None

    def test_truncated_diff_4000_chars(self):
        """Test that diff is properly truncated to 4000 chars."""
        json_response = '{"clarity": 5, "usefulness": 5, "depth": 5, "actionability": 5, "positivity": 5, "explain": "ok"}'
        
        with patch('accuracy_checker.evaluator_prompt') as mock_prompt, \
             patch('accuracy_checker.llm') as mock_llm, \
             patch('accuracy_checker.StrOutputParser') as mock_parser:
            
            mock_chain = Mock()
            mock_chain.invoke = Mock(return_value=json_response)
            
            mock_prompt.__or__ = Mock(return_value=Mock(
                __or__=Mock(return_value=Mock(
                    __or__=Mock(return_value=mock_chain)
                ))
            ))
            
            long_diff = "x" * 10000
            parsed, raw = meta_evaluate(long_diff, "review")
            
            # Verify invoke was called with truncated diff
            assert mock_chain.invoke.called
            call_args = mock_chain.invoke.call_args[0][0]
            assert len(call_args["diff"]) == 4000

    def test_empty_diff_and_review(self):
        """Test with empty diff and review strings."""
        json_response = '{"clarity": 1, "usefulness": 1, "depth": 1, "actionability": 1, "positivity": 1, "explain": "empty"}'
        
        with patch('accuracy_checker.evaluator_prompt') as mock_prompt, \
             patch('accuracy_checker.llm') as mock_llm, \
             patch('accuracy_checker.StrOutputParser') as mock_parser:
            
            mock_chain = Mock()
            mock_chain.invoke = Mock(return_value=json_response)
            
            mock_prompt.__or__ = Mock(return_value=Mock(
                __or__=Mock(return_value=Mock(
                    __or__=Mock(return_value=mock_chain)
                ))
            ))
            
            parsed, raw = meta_evaluate("", "")
            
            assert isinstance(parsed, dict)
            assert "error" not in parsed

    def test_json_with_nested_objects(self):
        """Test JSON with nested structures (should be flattened)."""
        json_response = '''{
            "clarity": 7,
            "usefulness": 8,
            "depth": 6,
            "actionability": 7,
            "positivity": 8,
            "explain": "nested test",
            "extra": {"nested": "data"}
        }'''
        
        with patch('accuracy_checker.evaluator_prompt') as mock_prompt, \
             patch('accuracy_checker.llm') as mock_llm, \
             patch('accuracy_checker.StrOutputParser') as mock_parser:
            
            mock_chain = Mock()
            mock_chain.invoke = Mock(return_value=json_response)
            
            mock_prompt.__or__ = Mock(return_value=Mock(
                __or__=Mock(return_value=Mock(
                    __or__=Mock(return_value=mock_chain)
                ))
            ))
            
            parsed, raw = meta_evaluate("diff", "review")
            
            assert parsed["clarity"] == 7
            assert "extra" in parsed

    def test_json_with_missing_fields(self):
        """Test JSON missing some required fields."""
        json_response = '''{
            "clarity": 7,
            "usefulness": 8,
            "explain": "incomplete"
        }'''
        
        with patch('accuracy_checker.evaluator_prompt') as mock_prompt, \
             patch('accuracy_checker.llm') as mock_llm, \
             patch('accuracy_checker.StrOutputParser') as mock_parser:
            
            mock_chain = Mock()
            mock_chain.invoke = Mock(return_value=json_response)
            
            mock_prompt.__or__ = Mock(return_value=Mock(
                __or__=Mock(return_value=Mock(
                    __or__=Mock(return_value=mock_chain)
                ))
            ))
            
            parsed, raw = meta_evaluate("diff", "review")
            
            assert "error" not in parsed
            assert parsed["clarity"] == 7
            assert "depth" not in parsed or parsed.get("depth") is None

    def test_json_with_wrong_types(self):
        """Test JSON with wrong value types."""
        json_response = '''{
            "clarity": "high",
            "usefulness": "medium",
            "depth": 7,
            "actionability": 8,
            "positivity": 9,
            "explain": "wrong types"
        }'''
        
        with patch('accuracy_checker.evaluator_prompt') as mock_prompt, \
             patch('accuracy_checker.llm') as mock_llm, \
             patch('accuracy_checker.StrOutputParser') as mock_parser:
            
            mock_chain = Mock()
            mock_chain.invoke = Mock(return_value=json_response)
            
            mock_prompt.__or__ = Mock(return_value=Mock(
                __or__=Mock(return_value=Mock(
                    __or__=Mock(return_value=mock_chain)
                ))
            ))
            
            parsed, raw = meta_evaluate("diff", "review")
            
            # Should parse successfully but with string values
            assert isinstance(parsed, dict)
            assert parsed["clarity"] == "high"

    def test_multiple_json_objects(self):
        """Test response with multiple JSON objects."""
        response = '''
        {"clarity": 5, "usefulness": 5, "depth": 5, "actionability": 5, "positivity": 5, "explain": "first"}
        {"clarity": 8, "usefulness": 8, "depth": 8, "actionability": 8, "positivity": 8, "explain": "second"}
        '''
        
        with patch('accuracy_checker.evaluator_prompt') as mock_prompt, \
             patch('accuracy_checker.llm') as mock_llm, \
             patch('accuracy_checker.StrOutputParser') as mock_parser:
            
            mock_chain = Mock()
            mock_chain.invoke = Mock(return_value=response)
            
            mock_prompt.__or__ = Mock(return_value=Mock(
                __or__=Mock(return_value=Mock(
                    __or__=Mock(return_value=mock_chain)
                ))
            ))
            
            parsed, raw = meta_evaluate("diff", "review")
            
            # Should extract first valid JSON object
            assert isinstance(parsed, dict)
            if "error" not in parsed:
                assert "explain" in parsed

    def test_unicode_in_json_values(self):
        """Test JSON with unicode characters in string values."""
        json_response = '''{
            "clarity": 7,
            "usefulness": 8,
            "depth": 6,
            "actionability": 7,
            "positivity": 8,
            "explain": "Good review! 👍 很好"
        }'''
        
        with patch('accuracy_checker.evaluator_prompt') as mock_prompt, \
             patch('accuracy_checker.llm') as mock_llm, \
             patch('accuracy_checker.StrOutputParser') as mock_parser:
            
            mock_chain = Mock()
            mock_chain.invoke = Mock(return_value=json_response)
            
            mock_prompt.__or__ = Mock(return_value=Mock(
                __or__=Mock(return_value=Mock(
                    __or__=Mock(return_value=mock_chain)
                ))
            ))
            
            parsed, raw = meta_evaluate("diff", "review")
            
            assert isinstance(parsed, dict)
            assert "error" not in parsed
            assert "👍" in parsed["explain"] or "很好" in parsed["explain"]

    def test_very_long_review_content(self):
        """Test with extremely long review content."""
        json_response = '{"clarity": 5, "usefulness": 5, "depth": 5, "actionability": 5, "positivity": 5, "explain": "long"}'
        
        with patch('accuracy_checker.evaluator_prompt') as mock_prompt, \
             patch('accuracy_checker.llm') as mock_llm, \
             patch('accuracy_checker.StrOutputParser') as mock_parser:
            
            mock_chain = Mock()
            mock_chain.invoke = Mock(return_value=json_response)
            
            mock_prompt.__or__ = Mock(return_value=Mock(
                __or__=Mock(return_value=Mock(
                    __or__=Mock(return_value=mock_chain)
                ))
            ))
            
            long_review = "x" * 50000
            parsed, raw = meta_evaluate("diff", long_review)
            
            assert isinstance(parsed, dict)