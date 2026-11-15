"""Build the reactor and launch the real code context endpoint for browser tests."""

import os
from pathlib import Path
import subprocess
import sys
import xml.etree.ElementTree as ET


repo = Path(__file__).resolve().parents[6]
scenario = os.environ.get("CODE_CONTEXT_BACKEND") == "scenarios"
module = "core/ouroboros-business-model/ouroboros-business-model-dev" if scenario else "core/ouroboros-logicflow/ouroboros-logicflow-dev"
subprocess.run(
    [
        "mvn", "-q", "-pl", module, "-am", "test",
        "-Dtest=BusinessModelCodeContextProviderTest" if scenario else "-Dtest=LogicFlowCodeContextProviderTest",
        "-Dsurefire.failIfNoSpecifiedTests=false",
    ],
    cwd=repo,
    check=True,
)
report = repo / module / ("target/surefire-reports/TEST-com.ouroboros.businessmodel.dev.BusinessModelCodeContextProviderTest.xml" if scenario else "target/surefire-reports/TEST-com.ouroboros.logicflow.dev.scriptintelligence.LogicFlowCodeContextProviderTest.xml")
properties = ET.parse(report).getroot().find("properties")
classpath = next(item.attrib["value"] for item in properties if item.attrib["name"] == "java.class.path")
os.chdir(repo)
os.execvp("java", ["java", "-cp", classpath,
    "com.ouroboros.businessmodel.dev.CodeContextScenarioBrowserServer" if scenario else "com.ouroboros.logicflow.dev.scriptintelligence.CodeIntelligenceBrowserServer", *sys.argv[1:]])
