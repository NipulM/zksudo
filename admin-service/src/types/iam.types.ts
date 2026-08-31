interface AssumeRoleStatement {
  Effect: "Allow";
  Action: "sts:AssumeRole";
  Resource: string[];
}

interface PolicyDocument {
  Version: string;
  Statement: AssumeRoleStatement[];
}
