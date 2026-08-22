from typing import Dict, Any, List, Callable, Type, Optional
from pydantic import BaseModel
from app.models.user import UserRole


class ToolDefinition(BaseModel):
    name: str
    description: str
    operation_type: str  # "READ" or "WRITE"
    requires_confirmation: bool
    allowed_roles: List[UserRole]
    arg_schema: Any
    handler: Any

    model_config = {"arbitrary_types_allowed": True}


class ToolRegistry:
    _registry: Dict[str, ToolDefinition] = {}

    @classmethod
    def register(cls, tool: ToolDefinition):
        cls._registry[tool.name] = tool

    @classmethod
    def get(cls, name: str) -> Optional[ToolDefinition]:
        return cls._registry.get(name)

    @classmethod
    def get_all(cls) -> Dict[str, ToolDefinition]:
        return cls._registry

    @classmethod
    def get_tools_for_role(cls, role: UserRole) -> List[Dict[str, Any]]:
        """Returns role-filtered tool schema descriptors for discovery and LLM function calling."""
        available = []
        for name, tool in cls._registry.items():
            if role in tool.allowed_roles:
                # Generate JSON schema for input parameters
                json_schema = tool.arg_schema.model_json_schema()
                available.append({
                    "name": tool.name,
                    "description": tool.description,
                    "operation_type": tool.operation_type,
                    "requires_confirmation": tool.requires_confirmation,
                    "input_schema": json_schema
                })
        return available
